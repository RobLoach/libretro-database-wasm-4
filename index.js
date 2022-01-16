const crc32 = require('crc/crc32')
const fs = require('fs')
const pkg = require('./package.json')
const carts = require('./wasm4/site/carts')

for (let cart of carts) {
    const file = "wasm4/site/static/carts/" + cart.slug + ".wasm"
    const fileStat = fs.statSync(file)
    const data = fs.readFileSync(file)
    cart.rom = {
        name: cart.slug + ".wasm",
        crc: crc32(data).toString(16),
        size: fileStat.size
    }
    cart.name = cart.title
    cart.description = cart.title
    cart.developer = cart.author
    cart.homepage = "https://wasm4.org/play/" + cart.slug
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
for (let cart of carts) {
    output += `
game (
    name "${cart.name}"
    description "${cart.description}"
    developer "${cart.developer}"
    homepage "${cart.homepage}"
    rom ( name "${cart.rom.name}" size "${cart.rom.size}" crc "${cart.rom.crc}" )
)
`
}

fs.writeFileSync("database/dat/WASM-4.dat", output.trim())