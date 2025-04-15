import { Clock, TriangleAlert, TrendingUp, TrendingDown } from "lucide-react";
import { useSettingStore } from "@/lib/settings";

type Props = {
  type: "call" | "put";
  symbol: string;
  value: number;
  entries: number;
  strikeRange: number[];
  expires: string; // unix timestamp
  date: string; // unix timestamp
  time: string;
};

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
  return Math.floor(date.getTime());
}

function getAlertDate(date: string, format: boolean, words: boolean): string {
  // Create a Date instance from a timestamp string.
  const d = new Date(parseInt(date, 10));
  const day = d.getDate();
  const year = d.getFullYear();
  const monthIndex = d.getMonth(); // zero-based

  // Prepare numeric representations (with 2-digit padding)
  const monthNumeric =
    monthIndex + 1 < 10 ? "0" + (monthIndex + 1) : String(monthIndex + 1);
  const dayNumeric = day < 10 ? "0" + day : String(day);

  // Array of full month names.
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Helper function to compute the ordinal suffix for the day.
  function getOrdinalSuffix(n: number): string {
    if (n % 100 >= 11 && n % 100 <= 13) {
      return "th";
    }
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  }

  // Determine the output string based on the flags.
  if (format) {
    if (words) {
      // When words are used, include the ordinal suffix in the day.
      return `${monthNames[monthIndex]} ${day}${getOrdinalSuffix(
        day
      )}, ${year}`;
    } else {
      // Use numeric month-day-year format with dashes.
      return `${monthNumeric}-${dayNumeric}-${year}`;
    }
  } else {
    // Regardless of words flag, return numeric format in YYYY-MM-DD.
    return `${year}-${monthNumeric}-${dayNumeric}`;
  }
}

function getTimeAgo(date: string) {
  const now = new Date();
  const pastDate = new Date(parseInt(date));
  const seconds = Math.floor((now.getTime() - pastDate.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
}

function formatNumber(num: number) {
  // Format the number with commas and two decimal places
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getStrikeRange(range: number[]) {
  // Format the range as "low-high"
  const low = range[0];
  const high = range[1];
  return `$${formatNumber(low)}-$${formatNumber(high)}`;
}

const AlertEntry = (props: Props) => {
  const { settings } = useSettingStore();

  return (
    <div className="w-full h-27 dark:bg-zinc-800 bg-[#F9FAFB] p-2.5 rounded-md mt-2 transition-colors duration-300 hover:bg-gray-200 dark:hover:bg-zinc-700">
      <div className="flex flex-row justify-between">
        <div className="flex flex-row gap-x-2 items-center">
          <p
            className={`rounded-full px-1.5 py-1 font-semibold text-white text-xxs transition-colors duration-400 ${
              props.type === "call"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {props.type === "call" ? "CALL" : "PUT"}
          </p>
          <h1 className="font-bold text-xs">{props.symbol}</h1>
        </div>

        <div className="flex flex-row gap-x-2 text-zinc-500 items-center">
          <Clock size={12} />
          <p className="text-xxxs">{getTimeAgo(props.date)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-12 gap-y-2 mt-2">
        <div className="flex flex-row items-center gap-x-1.5">
          <TriangleAlert size={12} className="text-[#F59E0C]" />
          <p className="text-xs">
            Total Value: <b>{formatNumber(props.value)}</b>
          </p>
        </div>
        <p className="text-xs">
          Entries: <b>{formatNumber(props.entries)}</b>
        </p>
        <p className="text-xs">
          Strike Range: <b>{getStrikeRange(props.strikeRange)}</b>
        </p>
        <p className="text-xs">
          Expires:{" "}
          <b>
            {getAlertDate(
              convertToUnixTimestamp(props.expires).toString(),
              settings.dateFormat,
              settings.dateWords
            )}
          </b>
        </p>
      </div>
      <div className="w-full justify-between flex flex-row mt-3">
        <p className="text-xxs text-zinc-500">
          Date:{" "}
          {getAlertDate(props.date, settings.dateFormat, settings.dateWords)}
        </p>
        <div
          className={`flex flex-row gap-x-2 transition-colors duration-400 ${
            props.type === "call"
              ? "text-green-500 hover:text-green-600"
              : "text-red-500 hover:text-red-600"
          }`}
        >
          {props.type === "put" ? (
            <TrendingDown size={12} />
          ) : (
            <TrendingUp size={12} />
          )}
          <p className="text-xxs font-semibold">
            {props.type == "put" ? "Bearish" : "Bullish"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlertEntry;
