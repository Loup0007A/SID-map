import type { Metadata, Viewport } from 'next';
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Waves from '@/components/Waves';
import SearchShortcut from '@/components/SearchShortcut';

// Anciens iPhone (iOS 15.0 à 15.3) : fonctions JavaScript récentes absentes, utilisées par les bibliothèques.
const POLYFILLS = `(function(){
if(!Object.hasOwn){Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k)}}
function at(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return n<0||n>=this.length?undefined:this[n]}
[Array,String].forEach(function(C){if(!C.prototype.at)Object.defineProperty(C.prototype,'at',{value:at,writable:true,configurable:true})});
if(typeof Uint8Array!=='undefined'&&!Uint8Array.prototype.at)Object.defineProperty(Uint8Array.prototype,'at',{value:at,writable:true,configurable:true});
if(!Array.prototype.findLast){Object.defineProperty(Array.prototype,'findLast',{value:function(f,t){for(var i=this.length-1;i>=0;i--){if(f.call(t,this[i],i,this))return this[i]}},writable:true,configurable:true})}
if(typeof structuredClone!=='function'){window.structuredClone=function(v){return JSON.parse(JSON.stringify(v))}}
})();`;

export const metadata: Metadata = {
  title: 'Wiki du S.I.D.',
  description: 'Le wiki de la S.I.D. : lieux, armes, monstres et trésors à découvrir !',
  applicationName: 'Wiki du S.I.D.',
  appleWebApp: { capable: true, title: 'Wiki S.I.D.', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#04070f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <Script id="polyfills" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: POLYFILLS }} />
        <Waves />
        <Header />
        <SearchShortcut />
        <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-5 pb-28 md:overflow-x-visible md:py-6 md:pb-6">{children}</main>
      </body>
    </html>
  );
}
