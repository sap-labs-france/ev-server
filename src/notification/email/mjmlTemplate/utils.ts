// flatten object
export const flatten = (context,data, tag = null) => {
  Object.keys(context).forEach((key) => {
    const tagT = !tag ? key : tag + '.' + key;
    if (typeof context[key] === 'object' && context[key] !== null) {
      flatten(context[key],data, tagT);
    } else {
      data[tagT] = context[key];
    }
  });
};
