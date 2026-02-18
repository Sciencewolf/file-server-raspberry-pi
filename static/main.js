const btn = document.getElementById("upload-btn")
const form = document.getElementById("upload-form")
const input = document.getElementById("upload-input")
const removeBtn = document.getElementById("remove-file")
const allFilesBtn = document.getElementById("all-files-btn")
const seeAllDiv = document.querySelector('.see-all')

const disconnectedTag = document.createElement("h1")
disconnectedTag.id = 'disconnect-h1'
disconnectedTag.innerHTML = "Disconnected"
disconnectedTag.style.fontSize = '5em'
document.body.appendChild(disconnectedTag)
disconnectedTag.hidden = true

const wrapperNewFile = document.getElementById('wrapper-new-file')
const newFileTextarea = document.getElementById('textarea-new-file')
const showNewFileCheckbox = document.getElementById("checkbox-new-file")
const uploadNewFileButton = document.getElementById('btn-send-new-file')
const fnameInput = document.getElementById('fname-input')
const fileExtensionInput = document.getElementById('file-ext-input')
const clearFileName = document.getElementById('btn-clear-filename')
const clearTextarea = document.getElementById('btn-clear-textarea')
// todo: check on upload filename and ext
clearFileName.addEventListener('click', () => {
    fnameInput.value = ''
    fileExtensionInput.value = ''
})

clearTextarea.addEventListener('click', () => {
    newFileTextarea.value = ''
})

showNewFileCheckbox.addEventListener('change', () => {
    if(!showNewFileCheckbox.checked) {
        wrapperNewFile.style.display = 'none'
    } else {
        wrapperNewFile.style.display = 'flex'
    }
})

showNewFileCheckbox.addEventListener('load', () => {
    if (!showNewFileCheckbox.checked) {
        wrapperNewFile.style.display = 'none'
    } else {
        wrapperNewFile.style.display = 'flex'
    }
})

uploadNewFileButton.addEventListener('click', async() => {
    const getText = newFileTextarea.value

    try {
        const callApi = await fetch(`/create?fname=${fnameInput.value}&ext=${fileExtensionInput.value}`, {
            method: 'POST',
            headers: { "X-API-KEY": sessionStorage.getItem('key') },
            body: getText
        })

        const response = await callApi.json()

        Toastify({
            text: response.info,
            duration: 4000,
            gravity: "top",
            position: "center"
        }).showToast()

        wrapperNewFile.style.display = 'none'
        showNewFileCheckbox.checked = false
    } catch(err) {
        console.log(err);
    }
})

document.addEventListener('DOMContentLoaded', () => {
    const urlParam = new URLSearchParams(location.search)
    const key = urlParam.get('key')

    if(key) {
        sessionStorage.setItem("key", key)
    }
})

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
                    border-radius: 1em;
                    width: fit-content;`

                for (const val of response.files) {
                    let filename = val

                    const pTag = document.createElement("p")
                    pTag.innerHTML = val

                    const downloadBtn = document.createElement("button")
                    downloadBtn.innerHTML = "Download"
                    downloadBtn.id = 'download-btn'
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


                    const renameBtn = document.createElement("button")
                    renameBtn.innerHTML = "Rename"
                    renameBtn.id = 'rename-btn'
                    renameBtn.addEventListener('click', async() => {
                        const prompt_value = prompt('Rename file')

                        const old_val_ext = String(val).split('.')[1]

                        filename = `${prompt_value}.${old_val_ext}`

                        if(prompt_value) {
                            const res = await fetch(`/rename/${val}?val=${filename}`, {
                                headers: {"X-API-KEY": key}
                            })

                            const data = await res.json()

                            Toastify({
                                text: data.info,
                                duration: 5000,
                                gravity: "top",
                                position: "center"
                            }).showToast()

                            pTag.innerHTML = filename
                        }
                    })

                    const preview = document.createElement('a')
                    preview.innerHTML = "Preview"
                    preview.id = 'preview-a'
                    preview.href = `/data/${pTag.innerHTML}`
                    preview.target = '_blank'

                    const deleteBtnWrapper = document.createElement('div')
                    deleteBtnWrapper.id = 'delete-btn-wrapper'

                    const deleteBtn = document.createElement("button")
                    deleteBtn.innerHTML = "Delete"
                    deleteBtn.id = 'delete-btn'
                    deleteBtn.addEventListener("click", async () => {
                        if (confirm(`Are you sure you want to delete '${filename}'?`)) {
                            const res = await fetch(`/delete/${filename}`, {
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

                            if(seeAllDiv.childNodes.length === 0) {
                                document.body.removeChild(seeAllDiv)
                                allFilesBtn.innerHTML = "See all files"
                            }
                        }
                    })

                    deleteBtnWrapper.appendChild(deleteBtn)

                    const wrapper = document.createElement("span")
                    wrapper.style.cssText = "display: flex;justify-content: center;align-items: center;gap: 0.5em;flex-direction: column;z-index: 5;"
                    wrapper.style.display = "flex"
                    wrapper.style.justifyContent = "center"
                    wrapper.style.alignItems = "center"
                    wrapper.style.gap = "0.5em"
                    wrapper.style.border = "1px solid black"

                    wrapper.appendChild(pTag)
                    const d = document.createElement('div')
                    d.appendChild(downloadBtn)
                    d.appendChild(renameBtn)
                    d.appendChild(preview)
                    d.appendChild(deleteBtnWrapper)

                    d.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 0.5em;'

                    wrapper.appendChild(d)
                    wrapper.style.backgroundColor = 'lightgreen'
                    wrapper.style.color = 'black'

                    seeAllDiv.appendChild(wrapper)
                    seeAllDiv.style.cssText = 'gap: 1em;'
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


setInterval(async() => {
    const key = sessionStorage.getItem("key")

    const res = await fetch("/connection", {
        headers: {"X-API-KEY": key}
    })

    const bodyTag = [...document.querySelector('body').childNodes].filter(item => item.nodeType === Node.ELEMENT_NODE)
    

    if(!res.ok) {
        bodyTag.forEach(child => {
            if(child.tagName === 'h1'.toUpperCase()) {
                child.hidden = false
            } else {
                child.style.display = 'none'
            }
        })
    } else {
        if(!document.getElementById('disconnect-h1').hidden) {
            window.location.reload()
        }
    }
}, 20_000)
