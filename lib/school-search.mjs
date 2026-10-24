// Keep Thai vowel/tone marks: suggestions match the spelling the learner types.
export function schoolSearchKey(value) {
 return String(value || '').normalize('NFKC').toLocaleLowerCase('th')
  .replace(/[\u200b-\u200d\ufeff]/g, '')
  .replace(/^\s*(?:โรงเรียน|ร\.?ร\.?)\s*/u, '')
  .replace(/[()]/gu, '')
  .replace(/\s+/gu, '').trim();
}

export function buildSchoolIndex(rows) {
 if (!Array.isArray(rows)) throw Error('Invalid school directory');
 return rows.filter(row => Array.isArray(row) && row.length >= 4 && row.slice(0,4).every(v => typeof v === 'string') && row[1].trim()).map(([id,name,province,district]) => ({
  id,name,province,district,key:schoolSearchKey(name),
  location:schoolSearchKey(province + ' ' + district),
 }));
}

export function suggestSchools(index, query, limit=10) {
 const value = String(query || '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
 const terms = value.split(/\s+/u).map(schoolSearchKey).filter(Boolean);
 if (!terms.length || !Number.isInteger(limit) || limit < 1) return [];
 const key=schoolSearchKey(value),groups=[[],[],[]];
 for (const school of index) {
  if (!terms.every(term => school.key.includes(term) || school.location.includes(term))) continue;
  const rank=school.key===key ? 0 : school.key.startsWith(key) ? 1 : 2;
  if (groups[rank].length < limit) groups[rank].push(school);
 }
 return groups.flat().slice(0,limit);
}

export function schoolInputValue(school) {
 const value=school.province ? `${school.name} (${school.province})` : school.name;
 return value.length <= 200 ? value : school.name;
}
