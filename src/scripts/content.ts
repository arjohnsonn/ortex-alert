import mockEntry from "@/components/mockEntry";
import mockSymbol from "@/components/mockSymbol";
import toastStyle from "@/components/toastStyle";
import { get, write } from "@/lib/storage";

type Settings = {
  enabled: boolean;
  darkMode: boolean;
  alertSound: boolean;
  valueThreshold: number;
  minStrike: number;
  maxStrike: number;
  minExp: number;
  maxExp: number;
};

const defaultSettings: Settings = {
  enabled: true,
  darkMode: true,
  alertSound: true,
  valueThreshold: 800000,
  minStrike: 100,
  maxStrike: 800,
  minExp: 0,
  maxExp: 365,
};

interface Entry {
  time: number;
  expiryDate: string; // DD MON format
  strike: number;
  type: "call" | "put" | "unknown";
  size: number;
  price: number;
  totalValue: number;
  reason: string;
  symbol?: string;
  id?: string;
  shownInAlert: boolean;
  verified: boolean;
  rowIndex?: string | null; // Added rowIndex field
}

interface Alert {
  expiryDate: string;
  type: "call" | "put" | "unknown";
  totalValue: number;
  entries: Entry[];
  timestamp: number; // unix ms timestamp
  symbol?: string; // Added symbol field
  id: string;
}

// SETTINGS
let VALUE_THRESHOLD = defaultSettings.valueThreshold;
const USE_INITIAL_ENTRY_CUTOFF: boolean = true; // if true, discard new entries with timestamp <= cutoff

const CURRENT_URL: string = window.location.href;
const IS_INTERESTING_OPTIONS_FLOW: boolean = CURRENT_URL.includes(
  "options?tab=interesting-options-flow"
);
const URL_SYMBOL: string | undefined = !IS_INTERESTING_OPTIONS_FLOW
  ? extractSymbolFromUrl(CURRENT_URL)
  : undefined;

console.log("URL Symbol:", URL_SYMBOL);

let settings: Settings;
(async () => {
  settings = (await get("settings")) as Settings;
  if (settings === undefined) {
    settings = defaultSettings;
    write("settings", defaultSettings);
  } else {
    // Reconcile missing fields
    settings = {
      ...defaultSettings,
      ...settings,
    };
  }

  VALUE_THRESHOLD = settings.valueThreshold;
  console.log("Settings loaded:", settings);
})();

chrome.runtime.onMessage.addListener(async function () {
  settings = (await get("settings")) as Settings;
  if (settings === undefined) {
    settings = defaultSettings;
    write("settings", defaultSettings);
  }

  VALUE_THRESHOLD = settings.valueThreshold;
  console.log("Settings updated:", settings);
});

function extractSymbolFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");

    if (pathParts.length >= 3) {
      return pathParts[pathParts.length - 2];
    }
  } catch (error) {
    console.error("Error extracting symbol from URL:", error);
  }
}

const iframe = document.createElement("iframe");
iframe.id = "audioIframe";
iframe.src = chrome.runtime.getURL("/iframe/audioPlayerIframe.html");
iframe.allow = "autoplay";

document.body.appendChild(iframe);

function playSound() {
  if (!settings.alertSound) return;

  iframe.contentWindow!.postMessage({ message: "play" }, "*");
}

let initialCutoffTime: number | null = null;
const symbolsByRowIndex: Map<string, string> = new Map();
const shownAlerts: Set<string> = new Set();
let lastTestEntryId: string | null = null;

/**
 * Wait for a container element (matched by selector) to become available,
 * then call the provided callback.
 */
const waitForContainer = (
  selector: string,
  callback: (element: HTMLElement) => void
) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) {
    callback(element);
  } else {
    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        callback(el);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

/**
 * Converts a string representing a date into a Unix timestamp (seconds).
 *
 * Supported formats:
 * - "today"
 *    → Returns today's date at 4:00 PM Eastern (3:00 PM CST).
 * - "tomorrow"
 *    → Returns tomorrow's date at midnight (local time).
 * - "DD MM" or "DD MM YYYY"
 *    → The date is interpreted at midnight (local time). If the year is omitted, the current year is assumed.
 * - "DD MM at HH:MM" or "DD MM YYYY at HH:MM"
 *    → Parses the date and time. In this case, the time is assumed to be in Central Standard Time (UTC‑06:00).
 *
 * @param input - The input date string.
 * @returns The Unix timestamp (in seconds) for the specified date/time.
 * @throws Error if the input format or date/time is invalid.
 */
function convertToUnixTimestamp(input: string): number {
  const trimmed = input.trim().toLowerCase();
  let date: Date;

  // Helper: Pads numbers to two digits.
  const pad = (n: number): string => (n < 10 ? "0" + n : n.toString());

  // Branch for the "at" format: "DD MM at HH:MM" or "DD MM YYYY at HH:MM"
  if (trimmed.includes("at")) {
    // Split the string into date and time parts.
    // For example: "11 apr at 15:10" => datePart: "11 apr", timePart: "15:10"
    const [datePart, timePart] = trimmed.split("at").map((part) => part.trim());

    // Parse the time (assumed to be in HH:MM format)
    const timeParts = timePart.split(":");
    if (timeParts.length !== 2) {
      throw new Error("Invalid time format. Expected HH:MM.");
    }
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    if (isNaN(hour) || isNaN(minute)) {
      throw new Error("Invalid time numbers provided.");
    }

    // Parse the date part.
    // The date part can be either "DD MM" or "DD MM YYYY". Month can be numeric or abbreviated.
    const dateComponents = datePart.split(" ").filter(Boolean);
    let dayNum: number;
    let monthNum: number;
    let yearNum: number;

    if (dateComponents.length === 2 || dateComponents.length === 3) {
      dayNum = parseInt(dateComponents[0], 10);
      if (isNaN(dayNum)) {
        throw new Error("Invalid day provided.");
      }

      const monthComponent = dateComponents[1];
      // Check if the month is numeric.
      if (/^\d+$/.test(monthComponent)) {
        monthNum = parseInt(monthComponent, 10) - 1;
      } else {
        // Support abbreviated month names.
        const monthMap: { [key: string]: number } = {
          jan: 0,
          feb: 1,
          mar: 2,
          apr: 3,
          may: 4,
          jun: 5,
          jul: 6,
          aug: 7,
          sep: 8,
          oct: 9,
          nov: 10,
          dec: 11,
        };
        const lowerMonth = monthComponent.toLowerCase();
        if (monthMap[lowerMonth] === undefined) {
          throw new Error("Invalid month provided.");
        }
        monthNum = monthMap[lowerMonth];
      }

      // If a year is provided, use it; otherwise, assume the current year.
      if (dateComponents.length === 3) {
        yearNum = parseInt(dateComponents[2], 10);
        if (isNaN(yearNum)) {
          throw new Error("Invalid year provided.");
        }
      } else {
        yearNum = new Date().getFullYear();
      }
    } else {
      throw new Error(
        'Invalid date part in "at" format. Expected "DD MM" or "DD MM YYYY".'
      );
    }

    // Create an ISO string that fixes the timezone to CST (-06:00).
    // Format: YYYY-MM-DDTHH:MM:00-06:00
    const isoString = `${yearNum}-${pad(monthNum + 1)}-${pad(dayNum)}T${pad(
      hour
    )}:${pad(minute)}:00-06:00`;
    date = new Date(isoString);
  } else if (trimmed === "today") {
    // Format "today": use the Intl API to get the current date in Eastern Time ("America/New_York").
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/New_York",
    };
    const estDateStr = new Intl.DateTimeFormat("en-US", options).format(
      new Date()
    );
    // estDateStr is in the format "MM/DD/YYYY" (e.g., "04/13/2025").
    const [month, day, year] = estDateStr.split("/");
    // Construct an ISO string for 4:00 PM with a fixed -05:00 offset (EST).
    const isoString = `${year}-${month}-${day}T16:00:00-05:00`;
    date = new Date(isoString);
  } else if (trimmed === "tomorrow") {
    // Create a date for tomorrow at midnight (local time).
    date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1);
  } else {
    // Handle the "DD MM" and "DD MM YYYY" formats without time.
    const parts = trimmed.split(" ").filter(Boolean);
    if (parts.length !== 2 && parts.length !== 3) {
      throw new Error(
        'Invalid input: expected "DD MM", "DD MM YYYY", "today", "tomorrow", or a format with "at".'
      );
    }

    const dayNum = parseInt(parts[0], 10);
    let monthNum: number;
    // Parse month; assume numeric.
    if (/^\d+$/.test(parts[1])) {
      monthNum = parseInt(parts[1], 10) - 1;
    } else {
      // Allow abbreviated month names.
      const monthMap: { [key: string]: number } = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const lowerMonth = parts[1].toLowerCase();
      if (monthMap[lowerMonth] === undefined) {
        throw new Error("Invalid month provided.");
      }
      monthNum = monthMap[lowerMonth];
    }
    let yearNum: number;
    if (parts.length === 3) {
      yearNum = parseInt(parts[2], 10);
      if (isNaN(yearNum)) {
        throw new Error("Invalid year provided.");
      }
    } else {
      yearNum = new Date().getFullYear();
    }

    if (isNaN(dayNum) || isNaN(monthNum)) {
      throw new Error("Invalid day or month provided.");
    }

    // Create a date at midnight (local time).
    date = new Date(yearNum, monthNum, dayNum);
    // Validate that the constructed date matches the user input.
    if (
      date.getDate() !== dayNum ||
      date.getMonth() !== monthNum ||
      date.getFullYear() !== yearNum
    ) {
      throw new Error("Invalid date provided.");
    }
  }

  // Convert the date's milliseconds to a Unix timestamp (seconds)
  return Math.floor(date.getTime() / 1000);
}

/**
 * Extract symbol from a pinned column row
 */
function extractSymbol(row: HTMLElement): string | undefined {
  // Find the paragraph with gray color
  const symbolElement = row.querySelector(
    'p[style*="color: rgb(128, 128, 128)"]'
  );
  if (symbolElement) {
    return symbolElement.textContent?.trim();
  }

  // alternative selectors if the first one doesn't work
  const allParagraphs = row.querySelectorAll("p");
  for (const p of allParagraphs) {
    const style = window.getComputedStyle(p);
    if (style.color === "rgb(128, 128, 128)") {
      return p.textContent?.trim();
    }
  }

  return undefined;
}

function parseClockTime(text: string): number {
  const lowerText = text.toLowerCase().trim();

  // Case 1: "yesterday at HH:MM"
  if (lowerText.startsWith("yesterday")) {
    // Remove "yesterday at" from text and then parse the time.
    const timePart = text.split("at")[1]?.trim() || "";
    const parts = timePart.split(":");
    if (parts.length !== 2) {
      return 0; // fallback if parsing fails
    }
    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);
    // Subtract one day (1440 minutes) from the computed total minutes.
    return hours * 60 + minutes - 1440;
  }
  // Case 2: "DD MM [YYYY] at HH:MM" format
  else if (lowerText.includes(" at ")) {
    // Split the input using " at " as a delimiter.
    const [datePart, timePart] = lowerText
      .split(" at ")
      .map((part) => part.trim());

    // Check if datePart looks like a date (has at least two tokens).
    const dateTokens = datePart.split(" ").filter(Boolean);
    if (dateTokens.length >= 2) {
      // Parse the day.
      const day = parseInt(dateTokens[0], 10);
      if (isNaN(day)) {
        throw new Error("Invalid day in date portion.");
      }

      // Parse the month, which may be numeric or abbreviated.
      let month: number;
      const monthToken = dateTokens[1];
      if (/^\d+$/.test(monthToken)) {
        month = parseInt(monthToken, 10);
      } else {
        const monthMap: { [key: string]: number } = {
          jan: 1,
          feb: 2,
          mar: 3,
          apr: 4,
          may: 5,
          jun: 6,
          jul: 7,
          aug: 8,
          sep: 9,
          oct: 10,
          nov: 11,
          dec: 12,
        };
        month = monthMap[monthToken];
        if (!month) {
          throw new Error("Invalid month in date portion.");
        }
      }
      // If a year is provided, use it; otherwise, assume the current year.
      let year: number;
      if (dateTokens.length === 3) {
        year = parseInt(dateTokens[2], 10);
        if (isNaN(year)) {
          throw new Error("Invalid year in date portion.");
        }
      } else {
        year = new Date().getFullYear();
      }

      // Now parse the time part ("HH:MM").
      const timeParts = timePart.split(":").map((s) => s.trim());
      if (timeParts.length !== 2) {
        throw new Error("Invalid time format in input.");
      }
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      if (isNaN(hour) || isNaN(minute)) {
        throw new Error("Invalid hour or minute in time portion.");
      }

      // Helper function to pad numbers to two digits.
      const pad = (n: number): string => (n < 10 ? "0" + n : n.toString());

      // Construct an ISO string that fixes the timezone to CST (-06:00).
      // Example: "2025-04-11T15:10:00-06:00"
      const isoString = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(
        minute
      )}:00-06:00`;
      const parsedDate = new Date(isoString);

      // Compute the difference in minutes from today's midnight (local time).
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      return Math.round(
        (parsedDate.getTime() - todayMidnight.getTime()) / (60 * 1000)
      );
    }
    // Fallback: if the part before "at" doesn't look like a date, try to parse the time alone.
    else {
      const timeParts = timePart.split(":");
      if (timeParts.length !== 2) {
        return 0;
      }
      const hour = Number.parseInt(timeParts[0], 10);
      const minute = Number.parseInt(timeParts[1], 10);
      return hour * 60 + minute;
    }
  }
  // Case 3: Simple time "HH:MM"
  else {
    const parts = text.trim().split(":");
    if (parts.length !== 2) {
      return 0; // fallback if parsing fails
    }
    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }
}

/**
 * Generate a unique ID for an entry
 */
function generateEntryId(entry: Entry): string {
  const uniqueProps = [
    entry.symbol || "unknown",
    entry.expiryDate,
    entry.type,
    entry.strike,
    entry.size,
    entry.price,
    entry.totalValue,
  ];

  return uniqueProps.join("-");
}

/**
 * Generate a unique ID for an alert based on its properties
 */
function generateAlertId(alert: Omit<Alert, "id">): string {
  return `${alert.expiryDate}-${alert.type}-${
    alert.symbol !== undefined ? alert.symbol : "unknown"
  }`;
}

function extractData(entry: HTMLDivElement): Entry {
  const mapping: { [key: string]: keyof Entry } = {
    time: "time",
    "expiry date": "expiryDate",
    strike: "strike",
    "call/put": "type",
    size: "size",
    price: "price",
    "total value": "totalValue",
    reason: "reason",
    shownInAlert: "shownInAlert",
  };

  const result: Partial<Entry> = {};
  const fieldElements = entry.querySelectorAll("[data-field]");

  fieldElements.forEach((el) => {
    const dataFieldRaw = el.getAttribute("data-field");
    if (!dataFieldRaw) return;
    const dataField = dataFieldRaw.toLowerCase().trim();
    const key = mapping[dataField];
    if (!key) return;

    const text = el.textContent?.trim() || "";
    switch (key) {
      case "time": {
        result[key] = parseClockTime(text);
        break;
      }
      case "strike":
      case "size":
      case "price":
      case "totalValue": {
        let num = Number.parseFloat(text);
        if (text.toLowerCase().includes("k")) {
          num *= 1000;
        } else if (text.toLowerCase().includes("m")) {
          num *= 1000000;
        }
        result[key] = num;
        break;
      }
      case "expiryDate": {
        result[key] = text;
        break;
      }
      case "reason": {
        result[key] = text;
        break;
      }
      case "type": {
        const lower = text.toLowerCase();
        if (lower === "c" || lower === "call") {
          result[key] = "call";
        } else if (lower === "p" || lower === "put") {
          result[key] = "put";
        } else {
          result[key] = "unknown";
        }
        break;
      }
      case "shownInAlert": {
        result[key] = false;
        break;
      }
      default:
        break;
    }
  });

  const extractedEntry = result as Entry;

  extractedEntry.shownInAlert = false;
  extractedEntry.rowIndex = entry.getAttribute("data-rowindex") || "";

  // Try to find symbol using all possible identifiers
  if (IS_INTERESTING_OPTIONS_FLOW) {
    const pinnedContainer = document.querySelector<HTMLElement>(
      ".MuiDataGrid-pinnedColumns--left"
    );
    if (pinnedContainer) {
      const firstRow = pinnedContainer.querySelector<HTMLElement>(
        `[data-rowindex="${extractedEntry.rowIndex}"]`
      );
      if (firstRow) {
        extractedEntry.symbol = extractSymbol(firstRow);
      }
    }
  } else if (URL_SYMBOL) {
    // For non-interesting options flow pages, use the symbol from the URL
    extractedEntry.symbol = URL_SYMBOL;
  }

  if (!extractedEntry.symbol) {
    extractedEntry.symbol = "UNKWN";
  }

  extractedEntry.id = generateEntryId(extractedEntry);

  return extractedEntry;
}

/**
 * Serializes an Entry to a JSON string.
 */
function serialize(entry: Entry, verified: boolean): string {
  entry.rowIndex = null;
  entry.verified = verified;

  return JSON.stringify(entry);
}

function createRelatedEntries(count = 3): Entry[] {
  const expiryDates = ["17 Apr", "24 Apr", "1 May", "8 May", "15 May"];
  const types = ["call", "put"] as const;
  const reasons = ["Large"];
  const symbols = [
    "AAPL",
    "MSFT",
    "TSLA",
    "AMZN",
    "GOOGL",
    "SPY",
    "QQQ",
    "IWM",
  ];

  const symbol =
    URL_SYMBOL && !IS_INTERESTING_OPTIONS_FLOW
      ? URL_SYMBOL
      : symbols[Math.floor(Math.random() * symbols.length)];
  const expiryDate =
    expiryDates[Math.floor(Math.random() * expiryDates.length)];
  const type = types[Math.floor(Math.random() * types.length)];

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const entries: Entry[] = [];

  for (let i = 0; i < count; i++) {
    const entry: Entry = {
      time: currentMinutes,
      expiryDate,
      strike: Math.floor(Math.random() * 500) + 100,
      type,
      size: Math.floor(Math.random() * 1000) + 50,
      price: Number.parseFloat((Math.random() * 10 + 1).toFixed(2)),
      totalValue: Math.floor(Math.random() * 100000) + 10000,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      symbol,
      shownInAlert: false,
      verified: false,
    };

    entry.id = generateEntryId(entry);
    entries.push(entry);
  }

  return entries;
}

function insertRelatedEntries(count = 3) {
  const container = document.querySelector<HTMLElement>(
    ".MuiDataGrid-virtualScrollerRenderZone"
  );
  if (!container) {
    console.error("Container not found");
    return;
  }

  const entries = createRelatedEntries(count);

  // Instead of using a random row index, use a local counter that increases sequentially.
  let localRowIndex = 0;

  const processEntryWithDelay = (index: number) => {
    if (index >= entries.length) return;

    const entry = entries[index];
    const entryElement = createEntryElement(entry);

    // Use the current sequential counter for both data-rowindex and aria-rowindex.
    const rowIndex = localRowIndex.toString();
    entryElement.setAttribute("data-rowindex", rowIndex);
    entryElement.setAttribute("aria-rowindex", rowIndex);
    localRowIndex++;

    if (container.firstChild) {
      container.insertBefore(entryElement, container.firstChild);
    } else {
      container.appendChild(entryElement);
    }

    if (IS_INTERESTING_OPTIONS_FLOW) {
      const symbolContainer = document.querySelector<HTMLElement>(
        ".MuiDataGrid-pinnedColumns--left"
      );
      if (symbolContainer) {
        const symbolElement = createSymbolColumnElement(
          entry.symbol || "TEST",
          rowIndex
        );
        if (symbolContainer.firstChild) {
          symbolContainer.insertBefore(
            symbolElement,
            symbolContainer.firstChild
          );
        } else {
          symbolContainer.appendChild(symbolElement);
        }
        symbolsByRowIndex.set(rowIndex, entry.symbol || "TEST");
      }
    }

    setTimeout(() => processEntryWithDelay(index + 1), 100);
  };

  processEntryWithDelay(0);
}

/**
 *
 * Toast Notification System
 *
 */

interface FlowAlert {
  id: string;
  date: string;
  move: "call" | "put";
  totalVolume: number;
  entries: number;
  symbol?: string;
  sector?: string;
  minStrikePrice?: number;
  maxStrikePrice?: number;
  expirationDate?: string;
  timestamp: number;
}

class OptionsFlowToastSystem {
  private toastContainer: HTMLElement | null = null;
  private isDarkMode = false;
  private initialized = false;
  private activeToasts: Set<string> = new Set();
  private toastDebounceTimers: Map<string, number> = new Map();

  constructor() {
    this.isDarkMode = this.detectDarkMode();
  }

  /**
   * Initialize the toast system
   */
  public init(): void {
    if (this.initialized) return;

    this.injectStyles();
    this.createToastContainer();
    this.initialized = true;

    console.log("Options Flow Toast system initialized");
  }

  /**
   * Detect if dark mode is preferred
   */
  private detectDarkMode(): boolean {
    const prefersDarkMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const htmlHasDarkClass =
      document.documentElement.classList.contains("dark") ||
      document.body.classList.contains("dark-mode") ||
      document.documentElement.getAttribute("data-theme") === "dark";

    const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
    const isDarkBackground = this.isColorDark(bodyBgColor);

    return prefersDarkMode || htmlHasDarkClass || isDarkBackground;
  }

  /**
   * Check if a color is dark based on its RGB values
   */
  private isColorDark(color: string): boolean {
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;

    const brightness =
      Number.parseInt(rgb[0]) * 0.299 +
      Number.parseInt(rgb[1]) * 0.587 +
      Number.parseInt(rgb[2]) * 0.114;

    return brightness < 128;
  }

  private injectStyles(): void {
    if (document.getElementById("options-flow-toast-styles")) return;

    const style = document.createElement("style");
    style.id = "options-flow-toast-styles";
    style.textContent = toastStyle();

    document.head.appendChild(style);
  }

  private createToastContainer(): void {
    let container = document.getElementById("options-flow-toast-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "options-flow-toast-container";
      document.body.appendChild(container);
    }

    this.toastContainer = container;
  }

  private createToast(alert: FlowAlert): HTMLElement {
    const toast = document.createElement("div");
    toast.className = `options-flow-toast ${alert.move}`;
    if (this.isDarkMode) {
      toast.classList.add("dark-mode");
    }
    toast.id = `toast-${alert.id}`;

    const moveClass = alert.move === "call" ? "call-text" : "put-text";
    const moveIcon =
      alert.move === "call"
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="call-text"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="put-text"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>';

    const alertIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f59e0b;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

    toast.innerHTML = `
      <div class="options-flow-toast-header">
        <div class="options-flow-toast-title">
          <span>${
            alert.symbol !== undefined ? alert.symbol : "Options Flow"
          }</span>
          <span class="${moveClass} text-uppercase">${alert.move.toUpperCase()}</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span class="options-flow-toast-badge">${
            alert.sector || alert.expirationDate
          }</span>
          <button class="options-flow-toast-close">&times;</button>
        </div>
      </div>
      <div class="options-flow-toast-content">
        <div class="options-flow-toast-row">
          <div class="flex-row">
            ${alertIcon}
            <span>Volume: <span class="options-flow-toast-volume">${alert.totalVolume.toLocaleString()}</span></span>
          </div>
          <div>Entries: <strong>${alert.entries}</strong></div>
        </div>
        <div class="options-flow-toast-row">
          ${
            alert.minStrikePrice
              ? `<span>Strike: $${alert.minStrikePrice} - $${alert.maxStrikePrice}</span>`
              : `<span>Expiry: ${alert.expirationDate}</span>`
          }
          <div class="flex-row">
            ${moveIcon}
            <span class="${moveClass}">${
      alert.move === "call" ? "Bullish" : "Bearish"
    }</span>
          </div>
        </div>
      </div>
      <div class="options-flow-toast-footer">
        <div>${new Date(alert.timestamp).toLocaleTimeString()}</div>
        <button class="options-flow-toast-action">View</button>
      </div>
    `;

    const closeButton = toast.querySelector(".options-flow-toast-close");
    closeButton?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeToast(toast);
    });

    const actionButton = toast.querySelector(".options-flow-toast-action");
    actionButton?.addEventListener("click", (e) => {
      e.stopPropagation();

      const viewEvent = new CustomEvent("optionsFlowToastView", {
        detail: { alert },
      });
      document.dispatchEvent(viewEvent);
      this.removeToast(toast);
    });

    toast.addEventListener("click", () => {
      const clickEvent = new CustomEvent("optionsFlowToastClick", {
        detail: { alert },
      });
      document.dispatchEvent(clickEvent);
    });

    return toast;
  }

  public showToast(alert: FlowAlert, duration = 8000): void {
    if (!this.initialized) {
      this.init();
    }

    if (!this.toastContainer) {
      this.createToastContainer();
    }

    if (this.toastDebounceTimers.has(alert.id)) {
      window.clearTimeout(this.toastDebounceTimers.get(alert.id));
      this.toastDebounceTimers.delete(alert.id);
    }

    this.toastDebounceTimers.set(
      alert.id,
      window.setTimeout(() => {
        if (this.activeToasts.has(alert.id)) {
          return;
        }

        if (shownAlerts.has(alert.id)) {
          return;
        }

        this.activeToasts.add(alert.id);

        shownAlerts.add(alert.id);

        const toast = this.createToast(alert);
        this.toastContainer!.appendChild(toast);

        if (duration > 0) {
          setTimeout(() => {
            this.removeToast(toast);
          }, duration);
        }

        this.toastDebounceTimers.delete(alert.id);
      }, 100)
    ); // 100ms debounce
  }

  private removeToast(toast: HTMLElement): void {
    const alertId = toast.id.replace("toast-", "");
    this.activeToasts.delete(alertId);

    toast.classList.add("removing");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200); // Match the animation duration
  }

  /**

   */
  public convertAlertToFlowAlert(alert: Alert): FlowAlert {
    // Find min and max strike prices from entries
    const strikes = alert.entries.map((entry) => entry.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);

    const symbolEntry = alert.entries.find((entry) => entry.symbol);
    const symbol =
      symbolEntry?.symbol !== undefined ? symbolEntry.symbol : alert.symbol;

    return {
      id: alert.id,
      date: new Date(alert.timestamp).toLocaleDateString(),
      move: alert.type === "call" || alert.type === "put" ? alert.type : "call",
      totalVolume: alert.totalValue,
      entries: alert.entries.length,
      expirationDate: alert.expiryDate,
      minStrikePrice: minStrike,
      maxStrikePrice: maxStrike,
      symbol: symbol,
      timestamp: alert.timestamp,
    };
  }
}

const toastSystem = new OptionsFlowToastSystem();
toastSystem.init();

function createRandomEntry(): Entry {
  const expiryDates = ["17 Apr", "24 Apr", "1 May", "8 May", "15 May"];
  const types = ["call", "put"] as const;
  const reasons = ["Large"];
  const symbols = [
    "AAPL",
    "MSFT",
    "TSLA",
    "AMZN",
    "GOOGL",
    "SPY",
    "QQQ",
    "IWM",
  ];

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const entry = {
    time: currentMinutes,
    expiryDate: expiryDates[Math.floor(Math.random() * expiryDates.length)],
    strike: Math.floor(Math.random() * 500) + 100,
    type: types[Math.floor(Math.random() * types.length)],
    size: Math.floor(Math.random() * 1000) + 50,
    price: Number.parseFloat((Math.random() * 10 + 1).toFixed(2)),
    totalValue: Math.floor(Math.random() * 100000) + 10000,
    reason: reasons[Math.floor(Math.random() * reasons.length)],
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    shownInAlert: false,
    verified: false,
  };

  const id = generateEntryId(entry);
  return {
    ...entry,
    id,
  };
}

function createEntryElement(entry: Entry): HTMLDivElement {
  const entryDiv = document.createElement("div");
  entryDiv.setAttribute("role", "row");
  entryDiv.className = "MuiDataGrid-row MuiDataGrid-row--dynamicHeight";
  entryDiv.setAttribute("aria-rowindex", "2");
  entryDiv.setAttribute("aria-selected", "false");
  entryDiv.style.maxHeight = "none";
  entryDiv.style.minHeight = "auto";

  const hours = Math.floor(entry.time / 60);
  const minutes = entry.time % 60;
  const timeDisplay = `${hours}:${minutes.toString().padStart(2, "0")}`;

  const formattedTotalValue =
    entry.totalValue >= 1000000
      ? `${(entry.totalValue / 1000000).toFixed(2)}M`
      : entry.totalValue >= 1000
      ? `${(entry.totalValue / 1000).toFixed(2)}k`
      : entry.totalValue.toString();

  entryDiv.innerHTML = mockEntry({
    timeDisplay: timeDisplay,
    expiryDate: entry.expiryDate,
    strike: entry.strike,
    type: entry.type === "call" ? "C" : "P",
    size: entry.size,
    price: entry.price,
    formattedTotalValue: formattedTotalValue,
    reason: entry.reason,
  });

  return entryDiv;
}

function createSymbolColumnElement(
  symbol: string,
  rowIndex: string
): HTMLDivElement {
  const symbolDiv = document.createElement("div");
  symbolDiv.setAttribute("role", "row");
  symbolDiv.className = "MuiDataGrid-row";
  symbolDiv.setAttribute("data-rowindex", rowIndex);
  symbolDiv.setAttribute("aria-rowindex", rowIndex);

  symbolDiv.innerHTML = mockSymbol({ symbol: symbol });

  return symbolDiv;
}

function addDebugButton() {
  if (document.getElementById("options-flow-debug-button")) {
    return;
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "fixed";
  buttonContainer.style.bottom = "20px";
  buttonContainer.style.right = "20px";
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.zIndex = "9999";

  const singleButton = document.createElement("button");
  singleButton.id = "options-flow-debug-button";
  singleButton.textContent = "Insert Test Entry";
  singleButton.style.backgroundColor = "#4f46e5";
  singleButton.style.color = "white";
  singleButton.style.border = "none";
  singleButton.style.borderRadius = "4px";
  singleButton.style.padding = "8px 16px";
  singleButton.style.fontSize = "14px";
  singleButton.style.cursor = "pointer";
  singleButton.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";

  let singleClickTimeout: number | null = null;
  singleButton.addEventListener("click", () => {
    if (singleClickTimeout) {
      return;
    }

    singleClickTimeout = window.setTimeout(() => {
      insertRandomEntry();
      singleClickTimeout = null;
    }, 300);
  });

  const multiButton = document.createElement("button");
  multiButton.id = "options-flow-multi-button";
  multiButton.textContent = "Insert Related Entries";
  multiButton.style.backgroundColor = "#10b981";
  multiButton.style.color = "white";
  multiButton.style.border = "none";
  multiButton.style.borderRadius = "4px";
  multiButton.style.padding = "8px 16px";
  multiButton.style.fontSize = "14px";
  multiButton.style.cursor = "pointer";
  multiButton.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";

  multiButton.addEventListener("click", () => {
    insertRelatedEntries(Math.floor(Math.random() * 3) + 3);
  });

  buttonContainer.appendChild(singleButton);
  buttonContainer.appendChild(multiButton);

  document.body.appendChild(buttonContainer);
}

function insertRandomEntry() {
  const container = document.querySelector<HTMLElement>(
    ".MuiDataGrid-virtualScrollerRenderZone"
  );
  if (!container) {
    console.error("Container not found");
    return;
  }

  const entry = createRandomEntry();

  if (URL_SYMBOL && !IS_INTERESTING_OPTIONS_FLOW) {
    entry.symbol = URL_SYMBOL;
  }

  if (lastTestEntryId === entry.id!) {
    return;
  }

  lastTestEntryId = entry.id!;

  const entryElement = createEntryElement(entry);

  const rowIndex = `test-${Date.now()}`;
  entryElement.setAttribute("data-rowindex", rowIndex);
  entryElement.setAttribute("aria-rowindex", rowIndex);

  if (container.firstChild) {
    container.insertBefore(entryElement, container.firstChild);
  } else {
    container.appendChild(entryElement);
  }

  if (IS_INTERESTING_OPTIONS_FLOW) {
    const symbolContainer = document.querySelector<HTMLElement>(
      ".MuiDataGrid-pinnedColumns--left"
    );
    if (symbolContainer) {
      const symbolElement = createSymbolColumnElement(
        entry.symbol || "TEST",
        rowIndex
      );
      if (symbolContainer.firstChild) {
        symbolContainer.insertBefore(symbolElement, symbolContainer.firstChild);
      } else {
        symbolContainer.appendChild(symbolElement);
      }

      symbolsByRowIndex.set(rowIndex, entry.symbol || "TEST");
    }
  }
}

const pendingAlertTimers: Map<string, number> = new Map();

function checkThresholdForEntry(
  newEntry: Entry,
  threshold: number,
  cache: string[]
): void {
  const symbol = newEntry.symbol || "unknown";
  const pendingAlertKey = `${symbol}-${newEntry.expiryDate}-${newEntry.type}`;

  if (pendingAlertTimers.has(pendingAlertKey)) {
    window.clearTimeout(pendingAlertTimers.get(pendingAlertKey));
  }

  pendingAlertTimers.set(
    pendingAlertKey,
    window.setTimeout(() => {
      processEntriesAfterDelay(newEntry, threshold, cache);
      pendingAlertTimers.delete(pendingAlertKey);
    }, 3500)
  );
}

function processEntriesAfterDelay(
  newEntry: Entry,
  threshold: number,
  cache: string[]
): void {
  const entries: Entry[] = cache
    .map((serialized) => {
      try {
        return JSON.parse(serialized) as Entry;
      } catch (e) {
        console.error("Error parsing entry:", e);
        return null;
      }
    })
    .filter((e): e is Entry => e !== null && e.verified == true);

  const uniqueEntriesMap = new Map<string, Entry>();

  entries.forEach((entry) => {
    if (entry.id) {
      uniqueEntriesMap.set(entry.id, entry);
    }
  });

  const entriesBySymbol: Record<string, Entry[]> = {};

  uniqueEntriesMap.forEach((entry) => {
    const symbol = entry.symbol || "unknown";
    if (!entriesBySymbol[symbol]) {
      entriesBySymbol[symbol] = [];
    }
    entriesBySymbol[symbol].push(entry);
  });

  Object.entries(entriesBySymbol).forEach(([symbol, symbolEntries]) => {
    // Skip unknown symbols
    if (symbol === "unknown") return;
    if (newEntry.symbol !== symbol) return;

    const matching = symbolEntries.filter(
      (e) =>
        e.expiryDate === newEntry.expiryDate &&
        e.type === newEntry.type &&
        e.symbol === newEntry.symbol &&
        e.shownInAlert === false
    );

    const total = matching.reduce((sum, e) => sum + e.totalValue, 0);

    if (total > threshold && matching.length >= 1) {
      matching.forEach((entry) => {
        entry.shownInAlert = true;
      });

      matching.forEach((entry) => {
        const index = cache.findIndex((serialized) => {
          try {
            const parsed = JSON.parse(serialized) as Entry;
            return parsed.id === entry.id;
          } catch (e) {
            console.error("Error parsing entry:", e);
            return false;
          }
        });
        if (index !== -1) {
          cache[index] = JSON.stringify(entry);
        }
      });

      get<Alert[]>("alerts").then((existingAlerts) => {
        const alerts = existingAlerts || [];

        const alertWithoutId = {
          expiryDate: newEntry.expiryDate,
          type: newEntry.type,
          totalValue: total,
          entries: matching,
          timestamp: Date.now(),
          symbol, // Include the symbol
        };

        const alertId = generateAlertId(alertWithoutId);

        const currentAlert = alerts.find((alert) => alert.id === alertId);

        if (currentAlert) {
          currentAlert.entries = matching;
          currentAlert.totalValue = total;
          currentAlert.timestamp = Date.now();

          playSound();
          toastSystem.showToast(
            toastSystem.convertAlertToFlowAlert(currentAlert)
          );
        } else {
          const newAlert: Alert = {
            ...alertWithoutId,
            id: alertId,
          };
          alerts.push(newAlert);

          playSound();
          toastSystem.showToast(toastSystem.convertAlertToFlowAlert(newAlert));
        }
        write("alerts", alerts);
      });
    }
  });
}

setInterval(() => {
  shownAlerts.clear();
}, 3 * 60 * 1000);

(async () => {
  let cache: string[] = [];

  setInterval(() => {
    cache = [];
  }, 4 * 60 * 1000);

  addDebugButton();

  waitForContainer(".MuiDataGrid-virtualScrollerRenderZone", (container) => {
    const observer = new MutationObserver((mutations) => {
      if (!settings || !settings.enabled) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName === "DIV"
          ) {
            const entryElement = node as HTMLDivElement;
            const entry = extractData(entryElement);

            if (entry.type == "unknown") {
              return;
            }

            const strikeStr = entry.strike.toString();
            const dotIndex = strikeStr.indexOf(".");
            if (
              dotIndex !== -1 &&
              strikeStr.length - dotIndex - 1 === 2 &&
              strikeStr.substring(dotIndex) !== ".5"
            ) {
              return;
            }

            if (entry.size % 1 !== 0) {
              return;
            }

            // Check settings

            if (entry.strike < settings.minStrike) {
              return;
            }
            if (entry.strike > settings.maxStrike) {
              return;
            }

            const expDateUnix = convertToUnixTimestamp(entry.expiryDate);
            if (expDateUnix < Date.now() / 1000) {
              return;
            }

            if (
              expDateUnix >
              Date.now() / 1000 + settings.maxExp * 24 * 60 * 60
            ) {
              return;
            }

            if (
              expDateUnix <
              Date.now() / 1000 + settings.minExp * 24 * 60 * 60
            ) {
              return;
            }

            const serializedNotVerified = serialize(entry, false);
            const serializedVerified = serialize(entry, true);

            if (
              !cache.includes(serializedNotVerified) &&
              !cache.includes(serializedVerified)
            ) {
              cache.push(serializedNotVerified);

              if (USE_INITIAL_ENTRY_CUTOFF) {
                if (initialCutoffTime === null) {
                  initialCutoffTime = entry.time;
                } else if (entry.time < 0) {
                  return;
                } else if (entry.time < initialCutoffTime) {
                  return;
                }
              }

              cache[cache.indexOf(serializedNotVerified)] = serializedVerified;

              write("entry-cache", cache);

              checkThresholdForEntry(entry, VALUE_THRESHOLD, cache);
            }
          }
        });
      });
    });
    observer.observe(container, { childList: true });
  });
})();
