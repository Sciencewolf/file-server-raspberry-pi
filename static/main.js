console.log("test")

const btn = document.getElementById("upload-btn")
const input = document.getElementById("upload-input")

btn.addEventListener("click", () => {
    console.log("btn pressed")
})

input.addEventListener("input", () => {
    console.log("input is inputted lol")
})