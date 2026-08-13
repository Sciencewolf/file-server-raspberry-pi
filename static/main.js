const btn =
    document.getElementById("upload-btn");

const form =
    document.getElementById("upload-form");

const input =
    document.getElementById("upload-input");

const removeBtn =
    document.getElementById("remove-file");


const allFilesBtn =
    document.getElementById("all-files-btn");

const seeAllDiv =
    document.querySelector(".see-all");


const wrapperNewFile =
    document.getElementById("wrapper-new-file");

const newFileTextarea =
    document.getElementById("textarea-new-file");

const showNewFileCheckbox =
    document.getElementById("checkbox-new-file");

const uploadNewFileButton =
    document.getElementById("btn-send-new-file");

const fnameInput =
    document.getElementById("fname-input");

const fileExtensionInput =
    document.getElementById("file-ext-input");

const clearFileName =
    document.getElementById("btn-clear-filename");

const clearTextarea =
    document.getElementById("btn-clear-textarea");


// ============================================================
// SERVER STATUS
// ============================================================

const serverStatus =
    document.getElementById("server-status");

const statusDot =
    document.getElementById("status-dot");

const statusText =
    document.getElementById("status-text");


function setServerStatus(online) {

    if (online) {

        serverStatus.classList.remove(
            "offline"
        );

        serverStatus.classList.add(
            "online"
        );

        statusText.textContent =
            "Online";

    } else {

        serverStatus.classList.remove(
            "online"
        );

        serverStatus.classList.add(
            "offline"
        );

        statusText.textContent =
            "Offline";
    }
}


// ============================================================
// CONNECTION CHECK
// ============================================================

async function checkConnection() {

    try {

        const response =
            await fetch(
                "/connection",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );
        }


        setServerStatus(true);


    } catch (error) {

        console.error(
            "Connection check failed:",
            error
        );


        setServerStatus(false);
    }
}


// Initial check

checkConnection();


// Check every 10 seconds

setInterval(
    checkConnection,
    10000
);


// ============================================================
// TOAST
// ============================================================

function showToast(message) {

    Toastify({

        text: message,

        duration: 3000,

        gravity: "top",

        position: "center",

        stopOnFocus: true,

        style: {

            background:
                "linear-gradient(135deg, #4f8cff, #6c5ce7)",

            borderRadius:
                "10px",

            boxShadow:
                "0 10px 30px rgba(0,0,0,0.3)"
        }

    }).showToast();
}


// ============================================================
// CREATE NEW FILE TOGGLE
// ============================================================

showNewFileCheckbox.addEventListener(
    "change",
    () => {

        wrapperNewFile.style.display =
            showNewFileCheckbox.checked
                ? "flex"
                : "none";

    }
);


// ============================================================
// CLEAR FILENAME
// ============================================================

clearFileName.addEventListener(
    "click",
    () => {

        fnameInput.value = "";

        fileExtensionInput.value = "";

        fnameInput.focus();

    }
);


// ============================================================
// CLEAR TEXTAREA
// ============================================================

clearTextarea.addEventListener(
    "click",
    () => {

        newFileTextarea.value = "";

        newFileTextarea.focus();

    }
);


// ============================================================
// CREATE NEW FILE
// ============================================================

uploadNewFileButton.addEventListener(
    "click",
    async () => {

        const filename =
            fnameInput.value.trim();

        const extension =
            fileExtensionInput.value
                .trim()
                .replace(/^\./, "");

        const content =
            newFileTextarea.value;


        if (!filename) {

            showToast(
                "Please enter a filename."
            );

            fnameInput.focus();

            return;
        }


        if (!extension) {

            showToast(
                "Please enter a file extension."
            );

            fileExtensionInput.focus();

            return;
        }


        try {

            uploadNewFileButton.disabled =
                true;

            uploadNewFileButton.textContent =
                "Creating...";


            const response =
                await fetch(
                    `/create?fname=${encodeURIComponent(filename)}&ext=${encodeURIComponent(extension)}`,
                    {
                        method: "POST",
                        body: content
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Failed to create file"
                );
            }


            const data =
                await response.json();


            showToast(
                data.info
            );


            fnameInput.value = "";

            fileExtensionInput.value = "";

            newFileTextarea.value = "";

            showNewFileCheckbox.checked =
                false;

            wrapperNewFile.style.display =
                "none";


            if (
                seeAllDiv.children.length > 0
            ) {

                await loadFiles();

            }

        } catch (error) {

            console.error(
                "Error creating file:",
                error
            );

            showToast(
                "Error creating file."
            );

        } finally {

            uploadNewFileButton.disabled =
                false;

            uploadNewFileButton.textContent =
                "Create file";
        }

    }
);


// ============================================================
// UPLOAD
// ============================================================

form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const file =
            input.files[0];


        if (!file) {

            showToast(
                "Please select a file."
            );

            return;
        }


        const data =
            new FormData();


        data.append(
            "file",
            file
        );


        try {

            btn.disabled =
                true;

            btn.textContent =
                "Uploading...";


            const response =
                await fetch(
                    "/upload",
                    {
                        method: "POST",
                        body: data
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Upload failed"
                );
            }


            const json =
                await response.json();


            showToast(
                json.info
            );


            input.value = "";

            btn.hidden =
                true;

            removeBtn.hidden =
                true;


            resetUploadText();


            if (
                seeAllDiv.children.length > 0
            ) {

                await loadFiles();

            }

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            showToast(
                "Error uploading file."
            );

        } finally {

            btn.disabled =
                false;

            btn.textContent =
                "Upload file";
        }

    }
);


// ============================================================
// FILE SELECTED
// ============================================================

input.addEventListener(
    "change",
    () => {

        if (
            input.files.length === 0
        ) {

            btn.hidden =
                true;

            removeBtn.hidden =
                true;

            resetUploadText();

            return;
        }


        const file =
            input.files[0];


        btn.hidden =
            false;

        removeBtn.hidden =
            false;


        const uploadText =
            document.querySelector(
                ".upload-text"
            );


        if (uploadText) {

            uploadText.innerHTML = `

                <strong>
                    ${escapeHtml(file.name)}
                </strong>

                <span>
                    ${formatFileSize(file.size)}
                </span>

            `;
        }

    }
);


// ============================================================
// REMOVE SELECTED FILE
// ============================================================

removeBtn.addEventListener(
    "click",
    () => {

        input.value = "";

        btn.hidden =
            true;

        removeBtn.hidden =
            true;

        resetUploadText();

    }
);


function resetUploadText() {

    const uploadText =
        document.querySelector(
            ".upload-text"
        );


    if (!uploadText) {
        return;
    }


    uploadText.innerHTML = `

        <strong>
            Choose a file
        </strong>

        <span>
            Click here to browse your device
        </span>

    `;
}


// ============================================================
// LOAD FILES
// ============================================================

async function loadFiles() {

    try {

        const response =
            await fetch(
                "/all",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to fetch files"
            );
        }


        const data =
            await response.json();


        seeAllDiv.innerHTML = "";


        if (
            !data.files ||
            data.files.length === 0
        ) {

            allFilesBtn.textContent =
                "View files";

            showToast(
                "No files found."
            );

            return;
        }


        for (
            const filename
            of data.files
        ) {

            createFileElement(
                filename
            );
        }


        allFilesBtn.textContent =
            "Hide files";


    } catch (error) {

        console.error(
            "Error fetching file list:",
            error
        );

        showToast(
            "Error fetching file list."
        );
    }
}


// ============================================================
// CREATE FILE ELEMENT
// ============================================================

function createFileElement(
    filename
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "file-item";


    const fileName =
        document.createElement(
            "p"
        );


    fileName.textContent =
        filename;

    fileName.title =
        filename;


    const actions =
        document.createElement(
            "div"
        );


    // --------------------------------------------------------
    // DOWNLOAD
    // --------------------------------------------------------

    const downloadBtn =
        document.createElement(
            "button"
        );


    downloadBtn.textContent =
        "Download";

    downloadBtn.id =
        "download-btn";


    downloadBtn.addEventListener(
        "click",
        async () => {

            try {

                downloadBtn.disabled =
                    true;

                downloadBtn.textContent =
                    "Downloading...";


                const response =
                    await fetch(
                        `/get/${encodeURIComponent(filename)}`
                    );


                if (!response.ok) {

                    throw new Error(
                        "Download failed"
                    );
                }


                const blob =
                    await response.blob();


                const url =
                    URL.createObjectURL(
                        blob
                    );


                const anchor =
                    document.createElement(
                        "a"
                    );


                anchor.href =
                    url;

                anchor.download =
                    filename;


                document.body.appendChild(
                    anchor
                );


                anchor.click();


                document.body.removeChild(
                    anchor
                );


                URL.revokeObjectURL(
                    url
                );


            } catch (error) {

                console.error(
                    "Download error:",
                    error
                );

                showToast(
                    `Error downloading ${filename}`
                );

            } finally {

                downloadBtn.disabled =
                    false;

                downloadBtn.textContent =
                    "Download";
            }

        }
    );


    // --------------------------------------------------------
    // RENAME
    // --------------------------------------------------------

    const renameBtn =
        document.createElement(
            "button"
        );


    renameBtn.textContent =
        "Rename";

    renameBtn.id =
        "rename-btn";


    renameBtn.addEventListener(
        "click",
        async () => {

            const extension =
                getFileExtension(
                    filename
                );


            const currentName =
                getFileNameWithoutExtension(
                    filename
                );


            const newName =
                prompt(
                    "Enter new filename:",
                    currentName
                );


            if (
                !newName ||
                !newName.trim()
            ) {

                return;
            }


            const cleanName =
                newName.trim();


            const newFilename =
                extension
                    ? `${cleanName}.${extension}`
                    : cleanName;


            try {

                renameBtn.disabled =
                    true;


                const response =
                    await fetch(
                        `/rename/${encodeURIComponent(filename)}?val=${encodeURIComponent(newFilename)}`
                    );


                if (!response.ok) {

                    throw new Error(
                        "Rename failed"
                    );
                }


                const data =
                    await response.json();


                showToast(
                    data.info
                );


                await loadFiles();


            } catch (error) {

                console.error(
                    "Rename error:",
                    error
                );

                showToast(
                    "Error renaming file."
                );

            } finally {

                renameBtn.disabled =
                    false;
            }

        }
    );


    // --------------------------------------------------------
    // PREVIEW
    // --------------------------------------------------------

    const preview =
        document.createElement(
            "a"
        );


    preview.textContent =
        "Preview";

    preview.id =
        "preview-a";

    preview.href =
        `/data/${encodeURIComponent(filename)}`;

    preview.target =
        "_blank";

    preview.rel =
        "noopener noreferrer";


    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------

    const deleteBtn =
        document.createElement(
            "button"
        );


    deleteBtn.textContent =
        "Delete";

    deleteBtn.id =
        "delete-btn";


    deleteBtn.addEventListener(
        "click",
        async () => {

            const confirmed =
                confirm(
                    `Are you sure you want to delete "${filename}"?`
                );


            if (!confirmed) {
                return;
            }


            try {

                deleteBtn.disabled =
                    true;

                deleteBtn.textContent =
                    "Deleting...";


                const response =
                    await fetch(
                        `/delete/${encodeURIComponent(filename)}`
                    );


                if (!response.ok) {

                    throw new Error(
                        "Delete failed"
                    );
                }


                const data =
                    await response.json();


                showToast(
                    data.info
                );


                await loadFiles();


            } catch (error) {

                console.error(
                    "Delete error:",
                    error
                );

                showToast(
                    `Error deleting ${filename}`
                );


                deleteBtn.disabled =
                    false;

                deleteBtn.textContent =
                    "Delete";
            }

        }
    );


    // --------------------------------------------------------
    // ASSEMBLE
    // --------------------------------------------------------

    actions.appendChild(
        downloadBtn
    );

    actions.appendChild(
        renameBtn
    );

    actions.appendChild(
        preview
    );

    actions.appendChild(
        deleteBtn
    );


    wrapper.appendChild(
        fileName
    );

    wrapper.appendChild(
        actions
    );


    seeAllDiv.appendChild(
        wrapper
    );
}


// ============================================================
// SHOW / HIDE FILES
// ============================================================

allFilesBtn.addEventListener(
    "click",
    async () => {

        const isVisible =
            seeAllDiv.children.length > 0;


        if (isVisible) {

            seeAllDiv.innerHTML = "";

            allFilesBtn.textContent =
                "View files";

            return;
        }


        allFilesBtn.disabled =
            true;

        allFilesBtn.textContent =
            "Loading...";


        await loadFiles();


        allFilesBtn.disabled =
            false;
    }
);


// ============================================================
// HELPERS
// ============================================================

function getFileExtension(
    filename
) {

    const lastDot =
        filename.lastIndexOf(".");


    if (lastDot === -1) {
        return "";
    }


    return filename.substring(
        lastDot + 1
    );
}


function getFileNameWithoutExtension(
    filename
) {

    const lastDot =
        filename.lastIndexOf(".");


    if (lastDot === -1) {
        return filename;
    }


    return filename.substring(
        0,
        lastDot
    );
}


function formatFileSize(
    bytes
) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    const size =
        bytes /
        Math.pow(
            1024,
            index
        );


    return `${size.toFixed(
        index === 0 ? 0 : 2
    )} ${units[index]}`;
}


function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value;


    return div.innerHTML;
}