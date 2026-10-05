/**
 * countries.ts — Single source of truth for the country list.
 *
 * Every Country <select> in the app (project form, onboarding, admin filters,
 * partner profile editors) must read from this file. Adding a new form to the
 * app is as simple as importing `COUNTRIES` and rendering it through
 * `SearchableCountrySelect` (or the existing `SearchableSelect`).
 *
 * - `COUNTRIES` is the full ISO 3166-1 list (~250 countries, alpha-2 codes).
 * - `AFRICAN_COUNTRIES` is a curated subset of the African continent (used
 *   to surface a "Suggested" group at the top of the country picker so
 *   Zambia + neighbouring markets remain 1-click away even after search
 *   becomes the dominant interaction).
 * - `findCountry(name)` is a case-insensitive lookup so legacy stored values
 *   like "south africa" still match.
 *
 * The project wizard pre-2018 also used country **ISO codes** (e.g. "ZA").
 * The store is now full country names, but the form tolerates either because
 * the matcher checks both the code and the name.
 */

export type Country = {
  /** ISO 3166-1 alpha-2 code (e.g. 'ZM', 'ZA'). */
  code: string;
  /** English short name. */
  name: string;
};

const RAW: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AX', name: 'Aland Islands' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic of the' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curacao' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands (Malvinas)' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'TF', name: 'French Southern Territories' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HM', name: 'Heard Island and McDonald Islands' },
  { code: 'VA', name: 'Holy See (Vatican City State)' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: "Korea, Democratic People's Republic of" },
  { code: 'KR', name: 'Korea, Republic of' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: "Lao People's Democratic Republic" },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia, Federated States of' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine, State of' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Reunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russian Federation' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BL', name: 'Saint Barthelemy' },
  { code: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'MF', name: 'Saint Martin (French part)' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SX', name: 'Sint Maarten (Dutch part)' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syrian Arab Republic' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States of America' },
  { code: 'UM', name: 'United States Minor Outlying Islands' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Viet Nam' },
  { code: 'VG', name: 'Virgin Islands, British' },
  { code: 'VI', name: 'Virgin Islands, U.S.' },
  { code: 'WF', name: 'Wallis and Futuna' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

/** All countries, alphabetically sorted by name. */
export const COUNTRIES: readonly Country[] = [...RAW].sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Curated African-continent subset. Sourced from the prior 18-country
 *  Zambia-pilot list, expanded to cover every African Union member state so
 *  the platform is ready for the Phase 10 pan-African expansion. */
const AFRICAN_CODES = new Set<string>([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD',
  'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
  'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
  'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
  'ZM', 'ZW',
]);

/** African subset, sorted to put Zambia first then alphabetical. */
export const AFRICAN_COUNTRIES: readonly Country[] = [
  ...COUNTRIES.filter((c) => c.code === 'ZM'),
  ...COUNTRIES.filter((c) => c.code !== 'ZM' && AFRICAN_CODES.has(c.code)),
];

/**
 * Case-insensitive lookup by either ISO code (e.g. "ZM") or full name
 * (e.g. "zambia" / "South Africa"). Returns the canonical Country, or null
 * if no match. Used to migrate legacy stored values that might have been
 * stored as code, name, or any-cased name.
 */
export function findCountry(value: string | null | undefined): Country | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  // Exact code match (case-insensitive)
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === v);
  if (byCode) return byCode;
  // Exact name match
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === v);
  if (byName) return byName;
  // Fuzzy: handle a few common legacy aliases (e.g. "DRC", "Congo (Kinshasa)")
  const alias: Record<string, string> = {
    drc: 'CD',
    'democratic republic of congo': 'CD',
    'congo, democratic republic of the': 'CD',
    'republic of congo': 'CG',
    congo: 'CG',
    'ivory coast': 'CI',
    "cote d'ivoire": 'CI',
    'cape verde': 'CV',
    tanzania: 'TZ',
    'united republic of tanzania': 'TZ',
    'swaziland': 'SZ',
    eswatini: 'SZ',
    'czech republic': 'CZ',
    'russia': 'RU',
    'south korea': 'KR',
    'north korea': 'KP',
    usa: 'US',
    uk: 'GB',
    uae: 'AE',
  };
  const aliased = alias[v];
  if (aliased) return COUNTRIES.find((c) => c.code === aliased) ?? null;
  return null;
}

/** Convenience: options for `<SearchableSelect>` / `<SearchableCountrySelect>`. */
export function countryOptions(
  list: readonly Country[] = COUNTRIES
): { value: string; label: string }[] {
  return list.map((c) => ({ value: c.name, label: c.name }));
}

/**
 * Curated region / province lists for a handful of countries where we have
 * a usable taxonomy. Countries without an entry are still accepted by the
 * form — the user just types the region in free text.
 */
export const COUNTRY_REGIONS: Record<string, string[]> = {
  Zambia: [
    'Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga',
    'Northern', 'North-Western', 'Southern', 'Western',
  ],
  Nigeria: [
    'Abuja', 'Lagos', 'Kano', 'Rivers', 'Oyo', 'Kaduna', 'Enugu', 'Anambra',
    'Delta', 'Ogun',
  ],
  Kenya: [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Nyeri', 'Eldoret', 'Machakos',
    'Kiambu', 'Meru', 'Kilifi',
  ],
  'South Africa': [
    'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State',
    'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
  ],
  Tanzania: [
    'Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Mbeya', 'Zanzibar',
    'Tanga', 'Morogoro', 'Kilimanjaro', 'Rukwa',
  ],
  Ghana: [
    'Greater Accra', 'Ashanti', 'Western', 'Central', 'Northern', 'Volta',
    'Eastern', 'Bono', 'Upper East', 'Upper West',
  ],
  Uganda: ['Central', 'Eastern', 'Northern', 'Western'],
  Rwanda: ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'],
  Ethiopia: [
    'Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'SNNPR', 'Somali',
    'Benishangul-Gumuz', 'Gambela', 'Dire Dawa',
  ],
  Egypt: [
    'Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez',
    'Ismailia', 'Red Sea', 'Matrouh',
  ],
  Mozambique: [
    'Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Zambezia', 'Nampula',
    'Cabo Delgado', 'Niassa', 'Tete', 'Manica',
  ],
  Zimbabwe: [
    'Harare', 'Bulawayo', 'Midlands', 'Manicaland', 'Mashonaland West',
    'Mashonaland Central', 'Mashonaland East', 'Masvingo',
    'Matabeleland North', 'Matabeleland South',
  ],
  Botswana: [
    'Gaborone', 'Francistown', 'Selebi-Phikwe', 'Maun', 'Kasane', 'Serowe',
    'Palapye', 'Molepolole', 'Mochudi', 'Lobatse',
  ],
  Namibia: [
    'Windhoek', 'Walvis Bay', 'Swakopmund', 'Oshakati', 'Rundu',
    'Grootfontein', 'Katima Mulilo', 'Keetmanshoop', 'Otjiwarongo', 'Gobabis',
  ],
  Malawi: [
    'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 'Karonga',
    'Nkhotakota', 'Ntcheu', 'Balaka', 'Mulanje',
  ],
  Angola: [
    'Luanda', 'Benguela', 'Huíla', 'Huambo', 'Lunda Norte', 'Lunda Sul',
    'Cabinda', 'Uíge', 'Malanje', 'Bié',
  ],
  Senegal: [
    'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba',
    'Mbour', 'Rufisque', 'Diourbel', 'Fatick',
  ],
  'Democratic Republic of the Congo': [
    'Kinshasa', 'Haut-Katanga', 'Nord-Kivu', 'Sud-Kivu', 'Kasaï-Oriental',
    'Kasaï-Central', 'Équateur', 'Tshopo', 'Maniema', 'Haut-Uélé',
  ],
  // Backwards-compatible aliases (some stored values use the older name)
  'Democratic Republic of Congo': [
    'Kinshasa', 'Haut-Katanga', 'Nord-Kivu', 'Sud-Kivu', 'Kasaï-Oriental',
    'Kasaï-Central', 'Équateur', 'Tshopo', 'Maniema', 'Haut-Uélé',
  ],
};
