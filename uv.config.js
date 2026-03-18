// UV Config - loaded after uv.bundle.js
// This file is served statically and referenced in index.html / proxy.html

self.__uv$config = {
  prefix: '/service/',
  bare:   '/bare/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  bundle:  '/uv/uv.bundle.js',
  config:  '/uv/uv.config.js',
  sw:      '/uv/uv.sw.js',
};
