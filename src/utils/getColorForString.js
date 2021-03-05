exports.getColorForString = (str) => {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const code = (hash & 0x00ffffff).toString(16).toUpperCase();

  const color = '00000'.substring(0, 6 - code.length) + code;

  return `#${color}`;
};
