const crc32 = require('crc/crc32')
const fs = require('fs')
const pkg = require('./package.json')
const glob = require("glob")
const frontmatter = require("frontmatter")
const path = require('path')
const removeMarkdown = require('markdown-to-text').default
const sanitizeFilename = require('sanitize-filename')
const archiver = require('archiver')
const dateParser = require('date-format-parse').parse

const mdFiles = glob.sync('wasm4/site/static/carts/*.md').sort()
let carts = []
for (let mdFile of mdFiles) {
    if (path.basename(mdFile) == 'README.md') {
        continue
    }
    let file = fs.readFileSync(mdFile, 'utf8')
    let cartData = frontmatter(file)

    let text = removeMarkdown(cartData.content).trim()
    let cart = {
        slug: path.basename(mdFile, '.md'),
        title: text.trim().split('\n')[0].replace('¢', '_'),
        author: cartData.data.github,
        description: text
    }
    carts.push(cart)
}

for (let cart of carts) {
    let file = "wasm4/site/static/carts/" + cart.slug + ".wasm"
    let fileStat = fs.statSync(file)
    let data = fs.readFileSync(file)
    cart.rom = {
        name: cart.slug + ".wasm",
        crc: crc32(data).toString(16),
        size: fileStat.size
    }
    cart.name = cart.title
    cart.description = cart.description.replace(/\n/g, ' ').replace('"', '\'').replace('  ', ' ').replace(cart.name, '').trim()
    if (cart.description.length == 0) {
        cart.description = cart.name
    }
    cart.developer = cart.author
    cart.homepage = "https://wasm4.org/play/" + cart.slug

    let cleanName = sanitizeFilename(cart.name, { replacement: '_' })
    fs.copyFileSync(`wasm4/site/static/carts/${cart.slug}.png`, `thumbs/Named_Titles/${cleanName}.png`)

    // Zip file
    let output = fs.createWriteStream(`${__dirname}/libretro-content/WASM-4/${cleanName}.zip`);
    let archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
    archive.pipe(output)
    archive.append(data, { name: `${cleanName}.wasm` })
    archive.append(fs.createReadStream("wasm4/site/static/carts/" + cart.slug + ".md"), { name: `${cleanName}.md` })
    archive.finalize()
}

let output = `
clrmamepro (
	name "WASM-4"
	description "WASM-4"
	version "${pkg.version}"
	author "${pkg.author}"
    homepage "${pkg.homepage}"
)
`

function cleanDescription(filename) {
    return sanitizeFilename(filename)
        .substring(0, 150)
        .replaceAll("\n", ' ')
        .replace('Original page on itch.io', '')
        .trim()
}

for (let cart of carts) {
    output += `
game (
    name "${cart.name}"
    description "${cleanDescription(cart.description)}"
    developer "${cart.developer}"
    homepage "${cart.homepage}"
    rom ( name "${cart.rom.name}" size ${cart.rom.size} crc ${cart.rom.crc} )
)
`
}

fs.writeFileSync("database/dat/WASM-4.dat", output.trim())