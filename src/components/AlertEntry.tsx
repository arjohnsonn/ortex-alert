import { Clock, TriangleAlert, TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  darkMode: boolean;
  type: "call" | "put";
  symbol: string;
  volume: number;
  entries: number;
  strikeRange: number[];
  expires: string; // unix timestamp
  date: string; // unix timestamp
  time: string;
};

function getDate(date: string) {
  // get in MM/DD/YYYY format
  const d = new Date(date);
  const month = d.getMonth() + 1; // Months are zero-based
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

function getAlertDate(date: string) {
  // get in YYYY-MM-DD format
  const d = new Date(date);
  const month = d.getMonth() + 1; // Months are zero-based
  const day = d.getDate();
  const year = d.getFullYear();
  return `${year}-${month < 10 ? "0" + month : month}-${
    day < 10 ? "0" + day : day
  }`;
}

function getTimeAgo(date: string) {
  const now = new Date();
  const pastDate = new Date(date);
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
  return (
    <div
      className={`w-full h-27 ${
        props.darkMode ? "bg-zinc-800" : "bg-[#F9FAFB]"
      } p-2.5 rounded-md mt-2`}
    >
      <div className="flex flex-row justify-between">
        <div className="flex flex-row gap-x-2 items-center">
          <p
            className={`bg-black rounded-full px-1.5 py-1 font-semibold text-white text-xxs ${
              props.type === "call" ? "bg-green-500" : "bg-red-500"
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
            Volume: <b>{formatNumber(props.volume)}</b>
          </p>
        </div>
        <p className="text-xs">
          Entries: <b>{formatNumber(props.entries)}</b>
        </p>
        <p className="text-xs">
          Strike Range: <b>{getStrikeRange(props.strikeRange)}</b>
        </p>
        <p className="text-xs">
          Expires: <b>{getDate(props.expires)}</b>
        </p>
      </div>
      <div className="w-full justify-between flex flex-row mt-3">
        <p className="text-xxs text-zinc-500">
          Date: {getAlertDate(props.date)}
        </p>
        <div
          className={`flex flex-row gap-x-2 ${
            props.type === "put" ? "text-red-500" : "text-green-500"
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
