import type { ReactNode } from 'react';
import type { Bulletin } from '../state/terminal';

/** One issued bulletin as a thumbnail -- the board and a suspect's record history both render this shape. */
export function BulletinThumb({ bulletin, caption, dense }: { bulletin: Bulletin; caption: ReactNode; dense?: boolean }) {
  return (
    <figure className={dense ? 'space-y-1' : 'space-y-2'}>
      <img src={bulletin.posterDataUrl} alt="" className="w-full border border-phosphor-dim" />
      <figcaption className={dense ? 'text-[9px] text-phosphor-dim' : 'text-[10px] text-phosphor-dim'}>{caption}</figcaption>
    </figure>
  );
}
