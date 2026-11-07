// Text-module declaration for HTML imports bundled by Wrangler (see `rules` in wrangler.jsonc).
declare module "*.html" {
  const content: string;
  export default content;
}
