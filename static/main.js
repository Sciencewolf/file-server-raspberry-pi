console.log("test")

const btn = document.getElementById("upload-btn")
const input = document.getElementById("upload-input")
const specs = document.getElementById("specs")

const getSpecs = async() => {
    try {
        const data = await fetch('https://willing-just-penguin.ngrok-free.app/specs')
        const response = await data.json()

        console.log(response)
    } catch(e) {
        console.log(e)
    }
}

btn.addEventListener("click", () => {
    console.log("btn pressed")
})

input.addEventListener("input", () => {
    console.log("input is inputted lol")
})

// setInterval(async() => {
//     await getSpecs()
// }, 100_000)