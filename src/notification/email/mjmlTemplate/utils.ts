// flatten object
export const getResolverData = (context, tag, data) => {
  Object.keys(context).forEach((key) => {
    const tagT = tag == '' ? key : tag + '.' + key;
    if (typeof context[key] === 'object' && context[key] !== null) {
      getResolverData(context[key], tagT, data);
    } else {
      data[tagT] = context[key];
    }
  });
};
