const KNOWN_NAME_KEYS = [
  'nickname',
  'username',
  'pseudo',
  'pseudonyme',
  'display_name',
  'displayname',
  'full_name',
  'fullname',
  'name',
  'nom',
  'rp_name',
  'character_name',
  'ic_name',
  'discord_username',
  'discord_name'
];
const EXCLUDED_KEYS = new Set([
  'id',
  'user_id',
  'status',
  'member_rank',
  'avatar_url',
  'hidden_fields',
  'is_founder',
  'is_muted',
  'created_at',
  'updated_at',
  'zone_id',
  'city_id'
]);

function looksLikeId(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || /^[0-9a-f]{20,}$/i.test(v);
}

export function displayName(p: any): string {
  for (const key of KNOWN_NAME_KEYS) {
    if (typeof p[key] === 'string' && p[key].trim()) return p[key];
  }
  for (const [key, value] of Object.entries(p)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim() && !value.startsWith('http') && !looksLikeId(value) && value.length < 60) {
      return value;
    }
  }
  return p.id;
}
