// Genera las páginas de "El Nido" a partir de los archivos markdown en content/nido/.
// Se ejecuta automáticamente en cada deploy de Netlify (ver netlify.toml).
// No hace falta tocar este archivo para escribir notas nuevas: eso se hace
// desde /admin (Decap CMS) o escribiendo un .md a mano en content/nido/.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'nido');
const OUTPUT_DIR = path.join(ROOT, 'nido');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'post.html');
const LISTING_PATH = path.join(ROOT, 'nido.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function slugify(text){
  return text.toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toDate(value){
  // gray-matter puede devolver la fecha ya como objeto Date; normalizamos a UTC
  // para que no dependa de la zona horaria del servidor de build.
  if(value instanceof Date) return value;
  return new Date(value + 'T00:00:00Z');
}

function formatLong(d){
  return d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ', ' + d.getUTCFullYear();
}

function formatShort(d){
  return d.getUTCDate() + ' ' + MESES_CORTOS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if(!fs.existsSync(CONTENT_DIR)){
  console.log('No hay carpeta content/nido, no genero notas.');
  process.exit(0);
}
if(!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

const posts = files.map(file => {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const { data, content } = matter(raw);
  const slug = data.slug || slugify(path.basename(file, '.md'));
  const date = toDate(data.date);
  const bodyHtml = marked.parse(content).trim()
    .split('\n')
    .map(line => line ? '    ' + line : line)
    .join('\n');

  return {
    slug,
    title: data.title || '(sin título)',
    author: data.author || 'Entregallos & Co',
    summary: data.summary || '',
    date,
    bodyHtml
  };
}).sort((a, b) => b.date - a.date);

// 1. generar cada página de nota
for(const post of posts){
  const html = template
    .replace(/{{TITLE}}/g, escapeHtml(post.title))
    .replace(/{{SUMMARY}}/g, escapeHtml(post.summary))
    .replace(/{{SLUG}}/g, post.slug)
    .replace(/{{DATE_LONG}}/g, formatLong(post.date))
    .replace(/{{AUTHOR}}/g, escapeHtml(post.author))
    .replace('{{BODY}}', post.bodyHtml);

  fs.writeFileSync(path.join(OUTPUT_DIR, post.slug + '.html'), html);
  console.log('Generado nido/' + post.slug + '.html');
}

// 2. borrar páginas de notas que ya no tengan un .md correspondiente
// (por ejemplo si se borra o renombra una nota desde el CMS)
const validSlugs = new Set(posts.map(p => p.slug));
if(fs.existsSync(OUTPUT_DIR)){
  for(const file of fs.readdirSync(OUTPUT_DIR)){
    if(!file.endsWith('.html')) continue;
    const slug = file.replace(/\.html$/, '');
    if(!validSlugs.has(slug)){
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
      console.log('Borrado nido/' + file + ' (ya no tiene .md)');
    }
  }
}

// 3. armar las tarjetas del listado en nido.html
const cardsHtml = posts.length
  ? posts.map(post => (
`      <a class="post-card" href="nido/${post.slug}.html">
        <span class="post-date">${formatShort(post.date)}</span>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.summary)}</p>
        <span class="post-read">Leer →</span>
      </a>`
    )).join('\n\n')
  : `      <div class="post-card is-empty">
        <span class="post-date">Próximamente</span>
        <h2>Tu próxima nota va acá</h2>
        <p>Estamos armando la siguiente. Volvé pronto.</p>
      </div>`;

let listingHtml = fs.readFileSync(LISTING_PATH, 'utf8');
listingHtml = listingHtml.replace(
  /<!--POSTS:START-->[\s\S]*<!--POSTS:END-->/,
  '<!--POSTS:START-->\n' + cardsHtml + '\n<!--POSTS:END-->'
);
fs.writeFileSync(LISTING_PATH, listingHtml);
console.log('Actualizado nido.html con ' + posts.length + ' nota(s).');

// 4. actualizar sitemap.xml: mantiene las urls que no son de /nido/ tal cual,
// y regenera las de /nido/ a partir de las notas actuales.
if(fs.existsSync(SITEMAP_PATH)){
  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const nidoUrls = [
`  <url>
    <loc>https://entregallos.netlify.app/nido.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  ].concat(posts.map(post => (
`  <url>
    <loc>https://entregallos.netlify.app/nido/${post.slug}.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`
  )));

  // saca cualquier <url> que apunte a /nido para reemplazarlas por las actuales
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/entregallos\.netlify\.app\/nido[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  sitemap = sitemap.replace('</urlset>', nidoUrls.join('\n') + '\n</urlset>');
  fs.writeFileSync(SITEMAP_PATH, sitemap);
  console.log('Actualizado sitemap.xml.');
}

console.log('Build de El Nido listo: ' + posts.length + ' nota(s).');
