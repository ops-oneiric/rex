import { COMMON_TIME_ZONES, timeZoneLabel } from "@/lib/time-zones";
import { Select } from "./input";

/**
 * Time zone picker. `otherZones` is computed on the server (otherTimeZones()) and passed
 * in, because the browser's list of zones can differ from Node's and break hydration.
 */
export function TimeZoneSelect({
  otherZones,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { otherZones: string[] }) {
  return (
    <Select {...props}>
      <optgroup label="United States">
        {COMMON_TIME_ZONES.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label} ({z.id})
          </option>
        ))}
      </optgroup>
      <optgroup label="Other time zones">
        {otherZones.map((id) => (
          <option key={id} value={id}>
            {timeZoneLabel(id)}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
