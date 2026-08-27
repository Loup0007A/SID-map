'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Vérifie si le membre connecté a une permission donnée (ou est
 * fondateur). S'appuie sur la RPC has_permission déjà utilisée par le
 * premier site.
 */
export function usePermission(permission: string) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_founder')
        .eq('id', user.id)
        .single();

      if (profile?.is_founder) {
        if (active) {
          setAllowed(true);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase.rpc('has_permission', {
        uid: user.id,
        perm: permission
      });

      if (active) {
        setAllowed(Boolean(data));
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [permission]);

  return { allowed, loading };
}
