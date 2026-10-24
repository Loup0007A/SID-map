import type { User } from '@supabase/supabase-js';
import { createClient } from './client';

/**
 * Membre connecté, lu sur place (cookie de session) : pas d'aller-retour
 * réseau, sauf si le jeton doit être rafraîchi. Remplace
 * `supabase.auth.getUser()`, qui interrogeait le serveur d'authentification
 * à chaque appel (et faisait attendre les autres requêtes derrière lui).
 * La base vérifie le jeton à chaque requête (RLS).
 *
 * Même forme de retour que `getUser()`.
 */
export async function currentUser(): Promise<{ data: { user: User | null } }> {
  const { data } = await createClient().auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}
