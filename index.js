const fs = require('fs')
const path = require('path')
const crc32 = require('crc/crc32')
const matter = require('gray-matter')
const removeMarkdown = require('markdown-to-text').default
const sanitizeFilename = require('sanitize-filename')
const archiver = require('archiver')
const pkg = require('./package.json')

const cartsDir = path.join(__dirname, 'wasm4/site/static/carts')
const thumbsDir = path.join(__dirname, 'thumbs/Named_Titles')
const contentDir = path.join(__dirname, 'libretro-content/WASM-4')
const datFile = path.join(__dirname, 'database/dat/WASM-4.dat')

// clrmamepro strings have no escape for quotes, and must stay on one line.
function datString(str) {
    return str.replaceAll('"', '\'').replace(/\s+/g, ' ').trim()
}

function cleanDescription(text) {
    return datString(text.replace(/Original page on itch\.io\.?/g, ''))
        .substring(0, 150)
        .trim()
}

function writeZip(zipPath, files) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        output.on('close', resolve)
        output.on('error', reject)
        archive.on('error', reject)
        archive.on('warning', reject)
        archive.pipe(output)
        for (const [name, data] of Object.entries(files)) {
            archive.append(data, { name })
        }
        archive.finalize()
    })
}

// Remove files left behind by carts that no longer exist upstream.
function removeStale(dir, ext, keep) {
    for (const file of fs.readdirSync(dir)) {
        if (file.endsWith(ext) && !keep.has(file)) {
            console.log(`Removing stale ${path.relative(__dirname, path.join(dir, file))}`)
            fs.rmSync(path.join(dir, file))
        }
    }
}

async function main() {
    fs.mkdirSync(thumbsDir, { recursive: true })
    fs.mkdirSync(contentDir, { recursive: true })

    const mdFiles = fs.readdirSync(cartsDir)
        .filter(file => file.endsWith('.md') && file !== 'README.md')
        .sort()

    const now = new Date()
    const version = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`
    let dat = `clrmamepro (
\tname "WASM-4"
\tdescription "WASM-4"
\tversion "${version}"
\tauthor "${pkg.author}"
\thomepage "${pkg.homepage}"
)
`

    const usedNames = new Set()
    const thumbs = new Set()
    const zips = new Set()

    for (const mdFile of mdFiles) {
        const slug = path.basename(mdFile, '.md')
        const md = fs.readFileSync(path.join(cartsDir, mdFile), 'utf8')
        const wasm = fs.readFileSync(path.join(cartsDir, `${slug}.wasm`))
        const { data, content } = matter(md)

        const lines = removeMarkdown(content).trim().split('\n')
        let name = datString(lines[0].replaceAll('¢', '_'))
        let fileName = sanitizeFilename(name, { replacement: '_' })
        if (usedNames.has(fileName.toLowerCase())) {
            console.warn(`Warning: "${name}" is already used, renaming ${slug}`)
            name = `${name} (${slug})`
            fileName = sanitizeFilename(name, { replacement: '_' })
        }
        usedNames.add(fileName.toLowerCase())

        const description = cleanDescription(lines.slice(1).join(' ')) || name
        // Authors are "Name <github>, ...", so keep just the names.
        const developer = data.github || data.author?.replace(/\s*<[^>]*>/g, '').trim()
        const romName = `${fileName}.wasm`
        const crc = crc32(wasm).toString(16).padStart(8, '0').toUpperCase()

        fs.copyFileSync(path.join(cartsDir, `${slug}.png`), path.join(thumbsDir, `${fileName}.png`))
        thumbs.add(`${fileName}.png`)

        await writeZip(path.join(contentDir, `${fileName}.zip`), {
            [romName]: wasm,
            [`${fileName}.md`]: md
        })
        zips.add(`${fileName}.zip`)

        dat += `
game (
\tname "${name}"
\tdescription "${description}"
${developer ? `\tdeveloper "${datString(developer)}"\n` : ''}\thomepage "https://wasm4.org/play/${slug}"
\trom ( name "${romName}" size ${wasm.length} crc ${crc} )
)
`
    }

    removeStale(thumbsDir, '.png', thumbs)
    removeStale(contentDir, '.zip', zips)

    fs.writeFileSync(datFile, dat.trim() + '\n')
    console.log(`Wrote ${mdFiles.length} carts to ${path.relative(__dirname, datFile)}`)
}

main().catch(err => {
    console.error(err)
    process.exitCode = 1
})
