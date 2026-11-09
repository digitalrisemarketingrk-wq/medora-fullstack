import { providers } from './medora-demo';
import type { CarePreferences } from './medora-features';

export const finderProviders = [...providers,
  { id: 'c7', name: 'Thames Diagnostic Centre', doctor: 'Diagnostic reception team', specialty: 'Diagnostics', initials: 'TD', type: 'Private', distance: '1.4 mi', address: 'Westminster, London', fee: 'Enquire at centre', accessible: true, languages: 'English, Hindi', rating: '4.7', slots: ['09:00', '11:00', '15:00'] },
  { id: 'c8', name: 'City Community Hospital', doctor: 'Hospital outpatient team', specialty: 'Hospital outpatient', initials: 'CH', type: 'NHS', distance: '2.6 mi', address: 'Camden, London', fee: 'NHS care', accessible: true, languages: 'English, Bengali, Urdu', rating: '4.8', slots: ['10:00', '13:30', '16:00'] },
  { id: 'c9', name: 'London Urgent Care Centre', doctor: 'Urgent care reception team', specialty: 'Urgent care', initials: 'UC', type: 'NHS', distance: '2.4 mi', address: 'Camden, London', fee: 'Enquire at centre', accessible: true, languages: 'English, Urdu', rating: '4.7', slots: ['09:00', '12:00', '15:00'] },
];
export type CareProvider = (typeof finderProviders)[number];
export const providerServices: Record<string, string[]> = { c1: ['GP', 'Health review', 'Walk-in enquiry'], c2: ['Heart clinic', 'Specialist consultation'], c3: ['Skin consultation'], c4: ['Dental care'], c5: ['Pharmacy', 'Prescription collection', 'Walk-in enquiry'], c6: ['Mental wellbeing'], c7: ['Blood test', 'X-ray', 'Diagnostic appointment'], c8: ['Outpatients', 'Walk-in enquiry'], c9: ['Urgent care enquiry', 'Walk-in enquiry'] };
export const providersAvailableToday = ['c1', 'c5', 'c7', 'c8', 'c9'];
export const careBoroughs = ['Westminster', 'Marylebone', 'Camden', 'Kensington', 'Islington'];
export function filterCareProviders(p: CarePreferences & { query: string; specialty: string; savedOnly: boolean; mapArea: string }) {
  return finderProviders.filter(provider =>
    (p.specialty === 'All specialties' || provider.specialty === p.specialty) &&
    (p.funding === 'All care types' || provider.type === p.funding) &&
    (p.language === 'Any language' || provider.languages.split(', ').includes(p.language)) &&
    (!p.accessible || provider.accessible) &&
    (p.urgency === 'Any urgency' || (p.urgency === 'Urgent care enquiry' ? provider.specialty === 'Urgent care' : provider.specialty !== 'Urgent care')) &&
    (p.availability === 'Any availability' || (p.availability === 'Today' ? providersAvailableToday.includes(provider.id) : (providerServices[provider.id] || []).includes('Walk-in enquiry'))) &&
    (!p.savedOnly || p.savedProviders.includes(provider.id)) &&
    (p.mapArea === 'All areas' || provider.address.startsWith(p.mapArea)) &&
    `${provider.name} ${provider.doctor} ${provider.specialty} ${provider.address} ${(providerServices[provider.id] || []).join(' ')}`.toLowerCase().includes(p.query.trim().toLowerCase())
  ).sort((a, b) => Number(b.address === p.area) - Number(a.address === p.area) || parseFloat(a.distance) - parseFloat(b.distance));
}
export function resolveBookingProvider(item?: { slots?: string[]; doctor?: string; specialty?: string; provider?: string; time?: string }, reschedule = false): CareProvider {
  if (item?.slots) return item as CareProvider;
  const known = finderProviders.find(p => p.doctor === item?.doctor);
  if (known) return known;
  if (item?.doctor && item.provider) return { ...finderProviders[0], id: 'imported', name: item.provider, doctor: item.doctor, specialty: item.specialty || 'Imported appointment', address: item.provider, fee: 'Imported calendar entry', slots: [...new Set([...(reschedule && item.time ? [item.time] : []), '09:00', '11:00', '14:00', '16:00'])].sort() };
  return finderProviders[0];
}
