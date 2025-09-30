const btn = document.getElementById("upload-btn")
const form = document.getElementById("upload-form")
const input = document.getElementById("upload-input")
const specs = document.getElementById("specs")
const removeBtn = document.getElementById("remove-file")
const allFilesBtn = document.getElementById("all-files-btn")
const seeAllDiv = document.querySelector('.see-all')

document.addEventListener('DOMContentLoaded', () => {
    const urlParam = new URLSearchParams(location.search)
    const key = urlParam.get('key')

    if(key) {
        sessionStorage.setItem("key", key)
    }
})

const getSpecs = async() => {
    try {
        const data = await fetch(`/specs`, {
            headers: { "X-API-KEY": sessionStorage.getItem("key") }
        })

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
        const res = await fetch(`/upload`, {
            method: "POST",
            headers: { "X-API-KEY": sessionStorage.getItem('key') },
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

allFilesBtn.addEventListener("click", async () => {
    if (allFilesBtn.innerHTML.includes("Hide")) {
        seeAllDiv.style.display = "none"
        seeAllDiv.innerHTML = ""
        allFilesBtn.innerHTML = "See all files"
    } else {
        const key = sessionStorage.getItem("key")

        try {
            const data = await fetch(`/all`, {
                headers: { "X-API-KEY": key }
            })
            const response = await data.json()

            if (response.files.length !== 0) {
                seeAllDiv.style.cssText = `display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.1em;
                    flex-direction: column;
                    background-color: grey;
                    padding: 1em;
                    border-radius: 1em;`

                for (const val of response.files) {
                    const pTag = document.createElement("p")
                    pTag.innerHTML = val

                    const downloadBtn = document.createElement("button")
                    downloadBtn.innerHTML = "Download"
                    downloadBtn.addEventListener("click", async () => {
                        try {
                            const res = await fetch(`/get/${val}`, {
                                headers: { "X-API-KEY": key }
                            })
                            if (!res.ok) throw new Error("Download failed")

                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)

                            const a = document.createElement("a")
                            a.href = url
                            a.download = val
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                        } catch (err) {
                            console.error(err)
                            Toastify({
                                text: `Error downloading ${val}`,
                                duration: 5000,
                                gravity: "top",
                                position: "center"
                            }).showToast()
                        }
                    })

                    const deleteBtn = document.createElement("button")
                    deleteBtn.innerHTML = "Delete"
                    deleteBtn.addEventListener("click", async () => {
                        if (confirm(`Are you sure you want to delete '${val}'?`)) {
                            const res = await fetch(`/delete/${val}`, {
                                headers: { "X-API-KEY": key }
                            })
                            const resJson = await res.json()

                            Toastify({
                                text: resJson.info,
                                duration: 5000,
                                gravity: "top",
                                position: "center"
                            }).showToast()

                            seeAllDiv.removeChild(wrapper)
                        }
                    })

                    const wrapper = document.createElement("span")
                    wrapper.style.display = "flex"
                    wrapper.style.justifyContent = "center"
                    wrapper.style.alignItems = "center"
                    wrapper.style.gap = "0.5em"

                    wrapper.appendChild(pTag)
                    wrapper.appendChild(downloadBtn)
                    wrapper.appendChild(deleteBtn)

                    seeAllDiv.appendChild(wrapper)
                }

                allFilesBtn.innerHTML = "Hide all files"
            } else {
                Toastify({
                    text: "No files fetched.",
                    duration: 5000,
                    gravity: "top",
                    position: "center"
                }).showToast()
            }
        } catch (err) {
            console.error(err)
            Toastify({
                text: "Error fetching file list.",
                duration: 5000,
                gravity: "top",
                position: "center"
            }).showToast()
        }
    }
})
