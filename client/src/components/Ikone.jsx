// Linijske ikone (stroke = currentColor)
const S = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const Meni = (p) => <S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>;
export const Lupa = (p) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>;
export const Zastavica = (p) => <S {...p}><path d="M6 3h12v18l-6-4-6 4z" /></S>;
export const ZastavicaPuna = (p) => <S {...p} fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z" /></S>;
export const Korpa = (p) => <S {...p}><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></S>;
export const Korisnik = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></S>;
export const Dio = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></S>;
export const Lokacija = (p) => <S {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></S>;
export const Telefon = (p) => <S {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></S>;
export const Kamion = (p) => <S {...p}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></S>;
export const Poruka = (p) => <S {...p}><path d="M4 5h16v11H8l-4 4z" /></S>;
export const Zatvori = (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const Auto = (p) => <S {...p}><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM5 11h14" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" /></S>;
export const Kuca = (p) => <S {...p}><path d="M3 11 12 4l9 7M5 10v10h14V10" /></S>;
export const Lista = (p) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>;
export const Postavke = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></S>;
export const Izlaz = (p) => <S {...p}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></S>;
export const Filter = (p) => <S {...p}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></S>;
export const Upload = (p) => <S {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></S>;

export function LogoZnak(p) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
      <rect width="64" height="64" rx="14" fill="#2c5d96" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="7" />
      <circle cx="32" cy="32" r="5" fill="#f59e0b" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round"><path d="M32 6v6M32 52v6M6 32h6M52 32h6" /></g>
    </svg>
  );
}
