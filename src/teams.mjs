// Ονόματα ομάδων (football-data → ελληνικά) και slugs για τις διευθύνσεις.
export const TEAMS = {
  'AEK': ['ΑΕΚ', 'aek'],
  'Aris': ['Άρης', 'aris'],
  'Asteras Tripolis': ['Αστέρας Τρίπολης', 'asteras-tripolis'],
  'Atromitos': ['Ατρόμητος', 'atromitos'],
  'Iraklis': ['Ηρακλής', 'iraklis'],
  'Kalamata': ['Καλαμάτα', 'kalamata'],
  'Kifisia': ['Κηφισιά', 'kifisia'],
  'Larisa': ['ΑΕΛ', 'ael'],
  'Levadeiakos': ['Λεβαδειακός', 'levadeiakos'],
  'OFI Crete': ['ΟΦΗ', 'ofi'],
  'Olympiakos': ['Ολυμπιακός', 'olympiakos'],
  'PAOK': ['ΠΑΟΚ', 'paok'],
  'Panathinaikos': ['Παναθηναϊκός', 'panathinaikos'],
  'Panetolikos': ['Παναιτωλικός', 'panaitolikos'],
  'Panserraikos': ['Πανσερραϊκός', 'panserraikos'],
  'Volos NFC': ['Βόλος', 'volos'],
  'Lamia': ['Λαμία', 'lamia'],
  'Athens Kallithea': ['Καλλιθέα', 'kallithea'],
  'PAS Giannina': ['ΠΑΣ Γιάννινα', 'pas-giannina'],
  'Giannina': ['ΠΑΣ Γιάννινα', 'pas-giannina'],
  'Ionikos': ['Ιωνικός', 'ionikos'],
  'Apollon Smyrnis': ['Απόλλων Σμύρνης', 'apollon-smyrnis'],
};
export const grName = t => TEAMS[t]?.[0] ?? t;
export const slugOf = t => TEAMS[t]?.[1] ?? t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
