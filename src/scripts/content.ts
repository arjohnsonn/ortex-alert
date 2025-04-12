import mockEntry from "@/components/mockEntry";
import mockSymbol from "@/components/mockSymbol";
import toastStyle from "@/components/toastStyle";

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

import { get, write } from "@/lib/storage";

// SETTINGS
const VALUE_THRESHOLD = 1;
const USE_INITIAL_ENTRY_CUTOFF: boolean = true; // if true, discard new entries with timestamp <= cutoff

function extractSymbolFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");

    if (pathParts.length >= 3) {
      return pathParts[pathParts.length - 1];
    }
  } catch (error) {
    console.error("Error extracting symbol from URL:", error);
  }
}

const CURRENT_URL: string = window.location.href;
const IS_INTERESTING_OPTIONS_FLOW: boolean = CURRENT_URL.includes(
  "options?tab=interesting-options-flow"
);
const URL_SYMBOL: string | undefined = !IS_INTERESTING_OPTIONS_FLOW
  ? extractSymbolFromUrl(CURRENT_URL)
  : undefined;

let initialCutoffTime: number | null = null;
const symbolsByRowIndex: Map<string, string> = new Map();
const pendingEntries: Map<string, { entry: Entry; cache: string[] }> =
  new Map();
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

/**
 * Get all possible row identifiers from an element
 */
function getRowIdentifiers(element: HTMLElement | null): string[] {
  if (!element) return [];

  const identifiers: string[] = [];

  const dataRowIndex = element.getAttribute("data-rowindex");
  if (dataRowIndex) identifiers.push(dataRowIndex);

  const ariaRowIndex = element.getAttribute("aria-rowindex");
  if (ariaRowIndex) identifiers.push(ariaRowIndex);

  const dataId = element.getAttribute("data-id");
  if (dataId) identifiers.push(dataId);

  return identifiers;
}

/**
 * Process any pending entries that were waiting for symbols
 */
function processPendingEntries() {
  pendingEntries.forEach((data, rowIndex) => {
    if (symbolsByRowIndex.has(rowIndex)) {
      const symbol = symbolsByRowIndex.get(rowIndex);
      data.entry.symbol = symbol;

      checkThresholdForEntry(data.entry, VALUE_THRESHOLD, data.cache);

      pendingEntries.delete(rowIndex);
    }
  });
}

/**
 * Parses a clock time string in "H:mm" or "HH:mm" format and returns
 * the total minutes since midnight.
 * Example: "1:06" returns 66, "1:05" returns 65.
 */
function parseClockTime(text: string): number {
  const lowerText = text.toLowerCase().trim();
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
  } else {
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
    Date.now(),
    Math.random, // to ensure uniqueness
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

  // Get row identifiers to find corresponding symbol
  const rowIdentifiers = getRowIdentifiers(entry);

  // Try to find symbol using all possible identifiers
  if (IS_INTERESTING_OPTIONS_FLOW) {
    for (const id of rowIdentifiers) {
      if (symbolsByRowIndex.has(id)) {
        result.symbol = symbolsByRowIndex.get(id);
        break;
      }
    }
  } else if (URL_SYMBOL) {
    // For non-interesting options flow pages, use the symbol from the URL
    result.symbol = URL_SYMBOL;
  }

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

  extractedEntry.id = generateEntryId(extractedEntry);
  extractedEntry.shownInAlert = false;

  return extractedEntry;
}

/**
 * Serializes an Entry to a JSON string.
 */
function serialize(entry: Entry): string {
  return JSON.stringify(entry);
}

function createRelatedEntries(count = 3): Entry[] {
  const expiryDates = ["17 Apr", "24 Apr", "1 May", "8 May", "15 May"];
  const types = ["call", "put"] as const;
  const reasons = ["Sweep", "Block", "Split", "Large"];
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
      time: currentMinutes - (i % 2),
      expiryDate,
      strike: Math.floor(Math.random() * 500) + 100,
      type,
      size: Math.floor(Math.random() * 1000) + 50,
      price: Number.parseFloat((Math.random() * 10 + 1).toFixed(2)),
      totalValue: Math.floor(Math.random() * 100000) + 10000,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      symbol,
      shownInAlert: false,
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
  console.log("Inserting entries:", entries);

  const processEntryWithDelay = (index: number) => {
    const entry = entries[index];
    if (!entry) return;

    console.log("Processing entry:", index, entry);

    const entryElement = createEntryElement(entry);

    const rowIndex = `test-${Date.now()}-${index}`;
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

    setTimeout(() => processEntryWithDelay(index + 1), 200);
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
  const reasons = ["Sweep", "Block", "Split", "Large"];
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
  console.log("Checking threshold for entry:", newEntry);

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
    }, 2000)
  );
}

function processEntriesAfterDelay(
  newEntry: Entry,
  threshold: number,
  cache: string[]
): void {
  console.log("Processing entries after delay:", newEntry);

  const entries: Entry[] = cache
    .map((serialized) => {
      try {
        return JSON.parse(serialized) as Entry;
      } catch (e) {
        console.error("Error parsing entry:", e);
        return null;
      }
    })
    .filter((e): e is Entry => e !== null);

  console.log(entries);

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

  console.log(entriesBySymbol);

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

    console.log("Matching entries:", matching);

    const total = matching.reduce((sum, e) => sum + e.totalValue, 0);

    if (IS_INTERESTING_OPTIONS_FLOW && !newEntry.symbol) {
      const rowIdentifiers = getRowIdentifiers(
        document.querySelector(
          `[data-rowindex="${newEntry.time}"]`
        ) as HTMLElement
      );
      if (rowIdentifiers.length > 0) {
        pendingEntries.set(rowIdentifiers[0], { entry: newEntry, cache });

        setTimeout(() => {
          processPendingEntries();
        }, 500);

        return;
      }
    }

    if (total > threshold && matching.length > 1) {
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

          toastSystem.showToast(
            toastSystem.convertAlertToFlowAlert(currentAlert)
          );
        } else {
          const newAlert: Alert = {
            ...alertWithoutId,
            id: alertId,
          };
          alerts.push(newAlert);

          toastSystem.showToast(toastSystem.convertAlertToFlowAlert(newAlert));
        }
        write("alerts", alerts);
      });
    }
  });
}

function monitorPinnedColumns() {
  if (!IS_INTERESTING_OPTIONS_FLOW) return;

  waitForContainer(".MuiDataGrid-pinnedColumns--left", (container) => {
    const rows = container.querySelectorAll('[role="row"]');
    rows.forEach((row) => {
      if (row instanceof HTMLElement) {
        const rowIdentifiers = getRowIdentifiers(row);
        for (const id of rowIdentifiers) {
          const symbol = extractSymbol(row);
          if (symbol) {
            symbolsByRowIndex.set(id, symbol);
          }
        }
      }
    });

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).getAttribute("role") === "row"
          ) {
            console.log("New row added:", node);
            const row = node as HTMLElement;
            const rowIdentifiers = getRowIdentifiers(row);
            for (const id of rowIdentifiers) {
              const symbol = extractSymbol(row);
              if (symbol) {
                symbolsByRowIndex.set(id, symbol);

                processPendingEntries();
              }
            }
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
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

  if (USE_INITIAL_ENTRY_CUTOFF && cache.length > 0) {
    const loadedEntries: Entry[] = cache
      .map((serialized) => {
        try {
          return JSON.parse(serialized) as Entry;
        } catch (e) {
          console.error("Error parsing entry:", e);
          return null;
        }
      })
      .filter((e): e is Entry => e !== null);

    initialCutoffTime = Math.max(...loadedEntries.map((e) => e.time));
  }

  addDebugButton();

  if (IS_INTERESTING_OPTIONS_FLOW) {
    monitorPinnedColumns();
  }

  waitForContainer(".MuiDataGrid-virtualScrollerRenderZone", (container) => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName === "DIV"
          ) {
            console.log("New row added:", node);
            const entryElement = node as HTMLDivElement;
            const entry = extractData(entryElement);

            const serialized = serialize(entry);

            if (!cache.includes(serialized)) {
              cache.push(serialized);

              if (USE_INITIAL_ENTRY_CUTOFF) {
                if (initialCutoffTime === null) {
                  initialCutoffTime = entry.time;
                } else if (entry.time <= initialCutoffTime) {
                  return;
                }
              }
              write("entry-cache", cache);

              // wait a short time to see if we can get the symbol
              if (IS_INTERESTING_OPTIONS_FLOW && !entry.symbol) {
                const rowIdentifiers = getRowIdentifiers(entryElement);
                if (rowIdentifiers.length > 0) {
                  setTimeout(() => {
                    for (const id of rowIdentifiers) {
                      if (symbolsByRowIndex.has(id)) {
                        entry.symbol = symbolsByRowIndex.get(id);
                        break;
                      }
                    }

                    checkThresholdForEntry(entry, VALUE_THRESHOLD, cache);
                  }, 100);
                } else {
                  checkThresholdForEntry(entry, VALUE_THRESHOLD, cache);
                }
              } else {
                checkThresholdForEntry(entry, VALUE_THRESHOLD, cache);
              }
            }
          }
        });
      });
    });
    observer.observe(container, { childList: true });
  });
})();
