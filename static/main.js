const btn = document.getElementById("upload-btn")
const form = document.getElementById("upload-form")
const input = document.getElementById("upload-input")
const specs = document.getElementById("specs")
const removeBtn = document.getElementById("remove-file")
const allFilesBtn = document.getElementById("all-files-btn")
const seeAllDiv = document.querySelector('.see-all')

const getSpecs = async() => {
    try {
        const data = await fetch('https://willing-just-penguin.ngrok-free.app/specs')
        const response = await data.json()

        console.log(response)
    } catch(e) {
        console.log(e)
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const file = input.files[0]
    if (!file) return

    const data = new FormData()
    data.append("file", file)

    try {
        const res = await fetch("/upload", {
            method: "POST",
            body: data
        })
        const json = await res.json()

        Toastify({
            text: json.info,
            duration: 4000,
            gravity: "top",
            position: "center"
        }).showToast()

        input.value = ''
        removeBtn.hidden = true
        btn.hidden = true
    } catch (err) {
        console.error(err)
    }
})

input.addEventListener("change", () => {
    if(input.value === "") {
        btn.hidden = true
        removeBtn.hidden = true
    } else {
        btn.hidden = false
        removeBtn.hidden = false
    }
})

removeBtn.addEventListener("click", () => {
    input.value = ""
    removeBtn.hidden = true
    btn.hidden = true
})

allFilesBtn.addEventListener("click", async() => {
    if(allFilesBtn.innerHTML.includes('Hide')) {
        seeAllDiv.style.display = 'none'
        seeAllDiv.innerHTML = ''
        allFilesBtn.innerHTML = "See all files"
    } else {
        const data = await fetch('https://willing-just-penguin.ngrok-free.app/all')
        const response = await data.json()

        if(response.files.length !== 0) {
            seeAllDiv.style.cssText = `display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.1em;
    flex-direction: column;
    background-color: grey;
    padding: 1em;
    border-radius: 1em;`

            for (const val of response.files) {
                const pTag = document.createElement('p')
                pTag.innerHTML = val

                const aTag = document.createElement('a')
                aTag.href = `/get/${val}`
                aTag.download = true
                aTag.innerHTML = "<button>Download</button>"

                const combineTags = document.createElement('span')
                combineTags.style.display = 'flex'
                combineTags.style.justifyContent = 'center'
                combineTags.style.alignItems = 'center'
                combineTags.style.gap = '0.5em'

                const buttonTagDelete = document.createElement('button')
                buttonTagDelete.id = "delete-btn"
                buttonTagDelete.innerHTML = "Delete"
                buttonTagDelete.addEventListener('click', async () => {

                    if (confirm(`Are you sure you want to delete '${val}'?`)) {
                        const res = await fetch(`https://willing-just-penguin.ngrok-free.app/delete/${val}`)
                        const resJson = await res.json()

                        Toastify({
                            text: resJson.info,
                            duration: 5000,
                            gravity: "top",
                            position: "center"
                        }).showToast();

                        seeAllDiv.removeChild(combineTags)
                    }
                })

                combineTags.appendChild(pTag)
                combineTags.appendChild(aTag)
                combineTags.appendChild(buttonTagDelete)

                seeAllDiv.appendChild(combineTags)
            }

            allFilesBtn.innerHTML = "Hide all files"
        } else {
            Toastify({
                text: "No files fetched.",
                duration: 5000,
                gravity: "top",
                position: "center"
            }).showToast();
        }
    }
})