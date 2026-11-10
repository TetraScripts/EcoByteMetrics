import { MapPin } from "lucide-react";
import { findCountry } from "../geography/geography";
import brazil from "../assets/flags/brasil.png";
import ireland from "../assets/flags/irlanda.png";
import japan from "../assets/flags/japao.png";
import canada from "../assets/flags/canada.png";
import unitedStates from "../assets/flags/estados-unidos.png";

const flags: Record<string, string> = { BR: brazil, IE: ireland, JP: japan, CA: canada, US: unitedStates };

export function CountryFlag({ country }: { country?: string | null }) {
  const place = findCountry(country ?? "");
  const name = place?.properties.name || country || "Localização não informada";
  const source = flags[place?.properties.code ?? ""];
  return <span className="country-flag" title={name}>
    {source ? <img src={source} alt={name} width={28} height={28} /> : <MapPin size={20} role="img" aria-label={name} />}
  </span>;
}
