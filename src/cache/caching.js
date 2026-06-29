import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 0,
});

export default cache;
