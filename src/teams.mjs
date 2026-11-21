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

// Σελίδα αγγλικής Wikipedia (για ρόστερ) και γενική πτώση ("του Παναθηναϊκού").
export const WIKI = {
  'AEK': ['AEK Athens F.C.', 'της ΑΕΚ'],
  'Aris': ['Aris Thessaloniki F.C.', 'του Άρη'],
  'Asteras Tripolis': ['Asteras Tripolis F.C.', 'του Αστέρα Τρίπολης'],
  'Atromitos': ['Atromitos F.C.', 'του Ατρομήτου'],
  'Iraklis': ['Iraklis F.C. (Thessaloniki)', 'του Ηρακλή'],
  'Kalamata': ['Kalamata F.C.', 'της Καλαμάτας'],
  'Kifisia': ['A.E. Kifisia F.C.', 'της Κηφισιάς'],
  'Larisa': ['AEL F.C.', 'της ΑΕΛ'],
  'Levadeiakos': ['Levadiakos F.C.', 'του Λεβαδειακού'],
  'OFI Crete': ['OFI Crete F.C.', 'του ΟΦΗ'],
  'Olympiakos': ['Olympiacos F.C.', 'του Ολυμπιακού'],
  'PAOK': ['PAOK FC', 'του ΠΑΟΚ'],
  'Panathinaikos': ['Panathinaikos F.C.', 'του Παναθηναϊκού'],
  'Panetolikos': ['Panetolikos F.C.', 'του Παναιτωλικού'],
  'Panserraikos': ['Panserraikos F.C.', 'του Πανσερραϊκού'],
  'Volos NFC': ['Volos F.C.', 'του Βόλου'],
  'Lamia': ['PAS Lamia 1964', 'της Λαμίας'],
  'Athens Kallithea': ['Athens Kallithea F.C.', 'της Καλλιθέας'],
};
export const genOf = t => WIKI[t]?.[1] ?? grName(t);

// ESPN (id ομάδας → όνομα football-data). Αν λείπει id, γίνεται αντιστοίχιση με το όνομα.
export const ESPN_ID = { 887: 'AEK', 5276: 'Levadeiakos', 8354: 'Asteras Tripolis', 132429: 'Kalamata', 2575: 'Iraklis', 443: 'Panathinaikos', 1010: 'OFI Crete', 6790: 'Atromitos', 435: 'Olympiakos', 605: 'PAOK', 11553: 'Aris', 11431: 'Panetolikos', 20043: 'Volos NFC', 21969: 'Kifisia' };
export const ESPN_NAME = { 'AEK Athens': 'AEK', 'Levadiakos': 'Levadeiakos', 'Asteras Tripoli': 'Asteras Tripolis', 'Olympiacos': 'Olympiakos', 'AEL Larissa': 'Larisa', 'Larissa': 'Larisa', 'PAS Lamia': 'Lamia', 'Lamia': 'Lamia', 'Athens Kallithea': 'Athens Kallithea', 'Panserraikos': 'Panserraikos' };
export const espnTeam = (id, name) => ESPN_ID[id] || ESPN_NAME[name] || name;

// Λέξεις για να βρεθούν τα προϊόντα κάθε ομάδας στο eshop (ελληνικά και λατινικά, χωρίς τόνους).
export const SHOP_KEYS = { Panathinaikos: ['παναθηναικ', 'panathinaikos', 'pao '], Olympiakos: ['ολυμπιακ', 'olympiacos', 'olympiakos'], AEK: ['αεκ', 'aek '], PAOK: ['παοκ', 'paok'], Aris: ['αρης', 'aris '], 'OFI Crete': ['οφη', 'ofi '], Iraklis: ['ηρακλη', 'iraklis'] };
