const jwt = require('jsonwebtoken');

const JWT_SECRET = 'coffee_life_roasters_secret_key_2024';
const JWT_REFRESH_SECRET = 'coffee_life_roasters_refresh_secret_key_2024';

// Генерация access токена (role: 'user' | 'admin', pointId для пользователей точки)
const generateAccessToken = (userId, username, role = 'user', pointId = null) => {
  const payload = { userId, username, role };
  if (pointId != null) payload.pointId = pointId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

// Генерация refresh токена
const generateRefreshToken = (userId, username) => {
  return jwt.sign(
    { userId, username },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

// Middleware для проверки access токена
const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token отсутствует' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Access token недействителен' });
    }
    req.user = user;
    next();
  });
};

// Только для роли admin (удаление клиентов, категорий и т.д.)
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
};

// Проверка refresh токена
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requireAdmin
};
