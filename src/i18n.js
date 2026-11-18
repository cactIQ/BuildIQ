// UI strings. Keyed by the English text; missing keys fall back to English (the key itself).
// Pure data + helpers (no DOM) so node tests can check completeness.
// hi / mr are machine-assisted drafts: NEEDS NATIVE REVIEW before any client use. They stay hidden until the
// language is listed in SPEC.i18n.enabled (and SPEC.i18n.reviewed[lang] should be set by the reviewer).
// Brand names and SPEC.brand content are never translated here.

/** Every English key the UI uses. tests/i18n.test.mjs checks ui.js/embed.js only call t() with these. */
export const STRINGS = [
  // top bar / controls
  'Tour', 'Stop tour', 'Time of day', 'Day', 'Golden', 'Dusk', 'Night', 'Presentation', 'Exit presentation',
  'Snapshot', 'Fullscreen', 'Exit fullscreen', 'Details', 'Close', 'UI size', 'Views', 'Language',
  // views
  'Hero', 'Aerial', 'Elevation', 'Pool', 'Clubhouse', 'Aerial North', 'Gym', 'Explore',
  // tags
  'Tower A', 'Tower B', 'Play area', 'Plaza', 'Entrance',
  // panel
  'Placeholder', 'Placeholder content', 'Key facts', 'Amenities', 'Enquire now', 'Registration', 'QR placeholder',
  'Fly to view', 'Towers', 'Floors',
  // loader
  'Loading', 'Welcome', 'Preparing materials', 'Building the site', 'Raising the towers', 'Placing amenities',
  'Planting the gardens', 'Adding details', 'Setting the light', 'Final touches', 'Preparing interior',
  // embed
  'View in 3D', 'Click to explore', 'Tap to explore', 'Press Esc to release',
  // tour captions (placeholder copy)
  'Placeholder caption',
  'Two residential towers set around landscaped open space.',
  'The full site plan: towers, pool deck, clubhouse and plaza.',
  'A classical facade with layered cornices and pediments.',
  'The pool deck with a raised kids’ pool and a jacuzzi.',
  'The clubhouse opens directly onto the pool deck.',
  'From the north: the rear tower and its rooftop gardens.',
  'Enquire to learn more about the project.',
  // misc
  'Snapshot saved', 'Snapshot failed', 'Interactive 3D view', 'Blank screen',
  'This device cannot show the live 3D view. Showing still images instead.', 'Image coming soon',
  'Previous', 'Next', 'Gallery', 'Something went wrong loading the interior.', 'N',
];

// NEEDS NATIVE REVIEW (Hindi)
const hi = {
  'Tour': 'टूर', 'Stop tour': 'टूर रोकें', 'Time of day': 'दिन का समय', 'Day': 'दिन', 'Golden': 'सुनहरा समय',
  'Dusk': 'संध्या', 'Night': 'रात', 'Presentation': 'प्रस्तुति', 'Exit presentation': 'प्रस्तुति से बाहर',
  'Snapshot': 'स्नैपशॉट', 'Fullscreen': 'पूर्ण स्क्रीन', 'Exit fullscreen': 'पूर्ण स्क्रीन से बाहर', 'Details': 'विवरण',
  'Close': 'बंद करें', 'UI size': 'आकार', 'Views': 'दृश्य', 'Language': 'भाषा',
  'Hero': 'मुख्य दृश्य', 'Aerial': 'हवाई दृश्य', 'Elevation': 'सामने का दृश्य', 'Pool': 'स्विमिंग पूल', 'Clubhouse': 'क्लबहाउस',
  'Aerial North': 'उत्तर से हवाई दृश्य', 'Gym': 'जिम', 'Explore': 'घूमें',
  'Tower A': 'टॉवर A', 'Tower B': 'टॉवर B', 'Play area': 'खेल क्षेत्र', 'Plaza': 'प्लाज़ा', 'Entrance': 'प्रवेश द्वार',
  'Placeholder': 'नमूना', 'Placeholder content': 'नमूना सामग्री', 'Key facts': 'मुख्य तथ्य', 'Amenities': 'सुविधाएँ',
  'Enquire now': 'अभी पूछताछ करें', 'Registration': 'पंजीकरण', 'QR placeholder': 'QR (नमूना)', 'Fly to view': 'दृश्य पर जाएँ',
  'Towers': 'टॉवर', 'Floors': 'मंज़िलें',
  'Loading': 'लोड हो रहा है', 'Welcome': 'स्वागत है', 'Preparing materials': 'सामग्री तैयार हो रही है',
  'Building the site': 'परिसर बन रहा है', 'Raising the towers': 'टॉवर बन रहे हैं', 'Placing amenities': 'सुविधाएँ लग रही हैं',
  'Planting the gardens': 'बगीचे लग रहे हैं', 'Adding details': 'बारीकियाँ जुड़ रही हैं', 'Setting the light': 'रोशनी सेट हो रही है',
  'Final touches': 'अंतिम तैयारी', 'Preparing interior': 'अंदरूनी दृश्य तैयार हो रहा है',
  'View in 3D': '3D में देखें', 'Click to explore': 'घूमने के लिए क्लिक करें', 'Tap to explore': 'घूमने के लिए टैप करें',
  'Press Esc to release': 'छोड़ने के लिए Esc दबाएँ',
  'Placeholder caption': 'नमूना कैप्शन',
  'Two residential towers set around landscaped open space.': 'हरे-भरे खुले स्थान के चारों ओर दो आवासीय टॉवर।',
  'The full site plan: towers, pool deck, clubhouse and plaza.': 'पूरा साइट प्लान: टॉवर, पूल डेक, क्लबहाउस और प्लाज़ा।',
  'A classical facade with layered cornices and pediments.': 'परतदार कॉर्निस और पेडिमेंट वाला शास्त्रीय अग्रभाग।',
  'The pool deck with a raised kids’ pool and a jacuzzi.': 'बच्चों के ऊँचे पूल और जकूज़ी के साथ पूल डेक।',
  'The clubhouse opens directly onto the pool deck.': 'क्लबहाउस सीधे पूल डेक पर खुलता है।',
  'From the north: the rear tower and its rooftop gardens.': 'उत्तर से: पिछला टॉवर और उसके छत के बगीचे।',
  'Enquire to learn more about the project.': 'प्रोजेक्ट के बारे में अधिक जानने के लिए पूछताछ करें।',
  'Snapshot saved': 'स्नैपशॉट सहेजा गया', 'Snapshot failed': 'स्नैपशॉट नहीं बन सका', 'Interactive 3D view': 'इंटरैक्टिव 3D दृश्य',
  'Blank screen': 'स्क्रीन खाली करें',
  'This device cannot show the live 3D view. Showing still images instead.': 'यह डिवाइस लाइव 3D दृश्य नहीं दिखा सकता। इसके बजाय चित्र दिखाए जा रहे हैं।',
  'Image coming soon': 'चित्र जल्द आएगा', 'Previous': 'पिछला', 'Next': 'अगला', 'Gallery': 'गैलरी',
  'Something went wrong loading the interior.': 'अंदरूनी दृश्य लोड करने में समस्या हुई।', 'N': 'उ',
};

// NEEDS NATIVE REVIEW (Marathi)
const mr = {
  'Tour': 'टूर', 'Stop tour': 'टूर थांबवा', 'Time of day': 'दिवसाची वेळ', 'Day': 'दिवस', 'Golden': 'सोनेरी वेळ',
  'Dusk': 'संध्याकाळ', 'Night': 'रात्र', 'Presentation': 'सादरीकरण', 'Exit presentation': 'सादरीकरणातून बाहेर',
  'Snapshot': 'स्नॅपशॉट', 'Fullscreen': 'पूर्ण स्क्रीन', 'Exit fullscreen': 'पूर्ण स्क्रीनमधून बाहेर', 'Details': 'तपशील',
  'Close': 'बंद करा', 'UI size': 'आकार', 'Views': 'दृश्ये', 'Language': 'भाषा',
  'Hero': 'मुख्य दृश्य', 'Aerial': 'हवाई दृश्य', 'Elevation': 'समोरील दृश्य', 'Pool': 'जलतरण तलाव', 'Clubhouse': 'क्लबहाऊस',
  'Aerial North': 'उत्तरेकडून हवाई दृश्य', 'Gym': 'जिम', 'Explore': 'फिरा',
  'Tower A': 'टॉवर A', 'Tower B': 'टॉवर B', 'Play area': 'खेळाचे क्षेत्र', 'Plaza': 'प्लाझा', 'Entrance': 'प्रवेशद्वार',
  'Placeholder': 'नमुना', 'Placeholder content': 'नमुना मजकूर', 'Key facts': 'मुख्य तथ्ये', 'Amenities': 'सुविधा',
  'Enquire now': 'आत्ताच चौकशी करा', 'Registration': 'नोंदणी', 'QR placeholder': 'QR (नमुना)', 'Fly to view': 'दृश्याकडे जा',
  'Towers': 'टॉवर', 'Floors': 'मजले',
  'Loading': 'लोड होत आहे', 'Welcome': 'स्वागत आहे', 'Preparing materials': 'साहित्य तयार होत आहे',
  'Building the site': 'परिसर तयार होत आहे', 'Raising the towers': 'टॉवर उभे राहत आहेत', 'Placing amenities': 'सुविधा लावल्या जात आहेत',
  'Planting the gardens': 'बागा लावल्या जात आहेत', 'Adding details': 'बारकावे जोडले जात आहेत', 'Setting the light': 'प्रकाश जुळवला जात आहे',
  'Final touches': 'अंतिम तयारी', 'Preparing interior': 'आतील दृश्य तयार होत आहे',
  'View in 3D': '3D मध्ये पहा', 'Click to explore': 'फिरण्यासाठी क्लिक करा', 'Tap to explore': 'फिरण्यासाठी टॅप करा',
  'Press Esc to release': 'सोडण्यासाठी Esc दाबा',
  'Placeholder caption': 'नमुना मथळा',
  'Two residential towers set around landscaped open space.': 'हिरव्यागार मोकळ्या जागेभोवती दोन निवासी टॉवर.',
  'The full site plan: towers, pool deck, clubhouse and plaza.': 'संपूर्ण साइट प्लॅन: टॉवर, पूल डेक, क्लबहाऊस आणि प्लाझा.',
  'A classical facade with layered cornices and pediments.': 'थरांच्या कॉर्निस आणि पेडिमेंटसह अभिजात दर्शनी भाग.',
  'The pool deck with a raised kids’ pool and a jacuzzi.': 'मुलांच्या उंच तलावासह आणि जकूझीसह पूल डेक.',
  'The clubhouse opens directly onto the pool deck.': 'क्लबहाऊस थेट पूल डेकवर उघडते.',
  'From the north: the rear tower and its rooftop gardens.': 'उत्तरेकडून: मागील टॉवर आणि त्याच्या छतावरील बागा.',
  'Enquire to learn more about the project.': 'प्रकल्पाबद्दल अधिक जाणून घेण्यासाठी चौकशी करा.',
  'Snapshot saved': 'स्नॅपशॉट जतन झाला', 'Snapshot failed': 'स्नॅपशॉट तयार होऊ शकला नाही', 'Interactive 3D view': 'परस्परसंवादी 3D दृश्य',
  'Blank screen': 'स्क्रीन रिकामी करा',
  'This device cannot show the live 3D view. Showing still images instead.': 'हे उपकरण थेट 3D दृश्य दाखवू शकत नाही. त्याऐवजी चित्रे दाखवली आहेत.',
  'Image coming soon': 'चित्र लवकरच', 'Previous': 'मागील', 'Next': 'पुढील', 'Gallery': 'गॅलरी',
  'Something went wrong loading the interior.': 'आतील दृश्य लोड करताना अडचण आली.', 'N': 'उ',
};

export const DICTS = { en: {}, hi, mr };
export const REVIEW_STATUS = { en: 'source', hi: 'needs native review', mr: 'needs native review' };
export const LANG_LABEL = { en: 'EN', hi: 'हिं', mr: 'मरा' };
export const DEVANAGARI = new Set(['hi', 'mr']);

/** Languages that may be shown: enabled in SPEC and with a dictionary. English is always available. */
export function enabledLanguages(SPEC) {
  const en = (SPEC && SPEC.i18n && Array.isArray(SPEC.i18n.enabled)) ? SPEC.i18n.enabled : ['en'];
  const out = en.filter((l) => Object.prototype.hasOwnProperty.call(DICTS, l));
  return out.includes('en') ? out : ['en', ...out];
}

/** Resolve the language to use: requested if enabled, otherwise English. */
export function resolveLang(SPEC, requested) {
  return enabledLanguages(SPEC).includes(requested) ? requested : 'en';
}

/** Translate an English key. Unknown language or missing key -> the English key itself. */
export function translate(key, lang = 'en', dicts = DICTS) {
  const d = dicts[lang];
  if (d && Object.prototype.hasOwnProperty.call(d, key) && typeof d[key] === 'string' && d[key]) return d[key];
  return key;
}

/** Translator bound to a language; t.lang, t.devanagari exposed for styling (no letter-spacing on Devanagari). */
export function createI18n(SPEC, requested = 'en') {
  const lang = resolveLang(SPEC, requested);
  const t = (key) => translate(key, lang);
  t.lang = lang;
  t.devanagari = DEVANAGARI.has(lang);
  t.languages = enabledLanguages(SPEC);
  return t;
}
