export const rand = (n) => {
  return Math.ceil(Math.random() * n);
};

export const pick = (arr, exclude) => {
  const a = arr.filter((e) => e != exclude);
  return a[rand(a.length) - 1];
};

export const cleanString = str => str.replace(/[<>]/gi, '');

export const isValidPos = (pos) => {
  return pos && pos.px >= 0 && pos.py >= 0 && pos.px <= 99 && pos.py <= 99;
};
