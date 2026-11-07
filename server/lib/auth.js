import jwt from 'jsonwebtoken';

const TAJNA = () => process.env.JWT_SECRET || 'razvoj-nije-za-produkciju';

export function potpisi(korisnik) {
  return jwt.sign(
    { id: korisnik.id, uloga: korisnik.uloga, otpad_id: korisnik.otpad_id || null },
    TAJNA(),
    { expiresIn: '30d' }
  );
}

// Čita token ako postoji, ali ne traži ga
export function opcionalno(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try { req.korisnik = jwt.verify(h.slice(7), TAJNA()); } catch { /* nevažeći token = gost */ }
  }
  next();
}

export function prijavljen(req, res, next) {
  opcionalno(req, res, () => {
    if (!req.korisnik) return res.status(401).json({ greska: 'Prijavite se.' });
    next();
  });
}

export function uloga(...dozvoljene) {
  return (req, res, next) =>
    prijavljen(req, res, () => {
      if (!dozvoljene.includes(req.korisnik.uloga)) return res.status(403).json({ greska: 'Nemate pristup.' });
      if (req.korisnik.uloga === 'otpad' && !req.korisnik.otpad_id)
        return res.status(403).json({ greska: 'Nalog nije povezan sa otpadom.' });
      next();
    });
}
