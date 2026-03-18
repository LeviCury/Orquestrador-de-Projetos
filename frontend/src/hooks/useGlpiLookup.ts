import { useState, useEffect, useRef } from 'react';
import { getGlpiTicket, type GlpiTicketInfo } from '@/api/client';

function extractTicketId(link: string): string | null {
  const m = link.match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

export default function useGlpiLookup(glpiLink: string) {
  const [info, setInfo] = useState<GlpiTicketInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetched = useRef('');

  useEffect(() => {
    const id = extractTicketId(glpiLink);

    if (!id) {
      setInfo(null);
      setLoading(false);
      lastFetched.current = '';
      return;
    }

    if (id === lastFetched.current) return;

    lastFetched.current = id;
    setLoading(true);
    getGlpiTicket(id)
      .then(data => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [glpiLink]);

  const ticketId = extractTicketId(glpiLink);

  const reset = () => {
    setInfo(null);
    lastFetched.current = '';
  };

  return { info, loading, ticketId, reset };
}
