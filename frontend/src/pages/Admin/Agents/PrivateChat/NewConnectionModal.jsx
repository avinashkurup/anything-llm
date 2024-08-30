import { useState } from "react";
import { createPortal } from "react-dom";
import ModalWrapper from "@/components/ModalWrapper";
import { X } from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import closeToast from "@/utils/closetoast";
import { DB_LOGOS } from "./DBConnection";
import { API_BASE } from "@/utils/constants";

// const API_BASE_URL = "http://localhost:3001"
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:3001";

const fileDataList = [];

function assembleConnectionString({
  engine,
  username = "",
  password = "",
  host = "",
  port = "",
  database = "",
}) {
  if ([username, password, host, database].every((i) => !!i) === false)
    return `Please fill out all the fields above.`;
  switch (engine) {
    case "postgresql":
      return `postgres://${username}:${password}@${host}:${port}/${database}`;
    case "mysql":
      return `mysql://${username}:${password}@${host}:${port}/${database}`;
    case "sql-server":
      return `mssql://${username}:${password}@${host}:${port}/${database}`;
    default:
      return null;
  }
}

const DEFAULT_ENGINE = "postgresql";
const DEFAULT_CONFIG = {
  username: null,
  password: null,
  host: null,
  port: null,
  database: null,
};

export default function NewSQLConnection({ isOpen, closeModal, onSubmit }) {
  const [engine, setEngine] = useState(DEFAULT_ENGINE);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [files, setFiles] = useState([]);
  if (!isOpen) return null;

  function handleClose() {
    setEngine(DEFAULT_ENGINE);
    setConfig(DEFAULT_CONFIG);
    onSubmit(files);
    closeModal();
  }

  function onFormChange() {
    const form = new FormData(document.getElementById("sql-connection-form"));
    setConfig({
      username: form.get("username").trim(),
      password: form.get("password"),
      host: form.get("host").trim(),
      port: form.get("port").trim(),
      database: form.get("database").trim(),
    });
  }

  const FileUpload = () => {

    const handleFileChange = (e) => {
      const selectedFiles = Array.from(e.target.files);

      const csvFiles = selectedFiles.filter((file) => file.type === "text/csv");

      if (csvFiles.length > 0) {
        setFiles([...files, ...csvFiles]);
        csvFiles.forEach((file) => {
          fileDataList.push(file);
          console.log(`Added file: ${file.name} to fileDataList`, fileDataList);
         });
      } else {
        alert("Please upload valid CSV files.");
      }
    };

    const handleRemoveFile = (fileName) => {
      const updatedFiles = files.filter((file) => file.name !== fileName);
      setFiles(updatedFiles);
    };

    return (
      <div className="flex flex-col w-full">
        <label className="text-white text-sm font-semibold block mb-3">
          Upload CSV Files
        </label>
        <input
          type="file"
          name="myFile"
          accept=".csv"
          className="border-none bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          multiple // Allow multiple file selection
          onChange={handleFileChange}
        />
        {files.length > 0 && (
          <div className="mt-3">
            <p className="text-white text-sm mb-1">Selected files:</p>
            <ul className="text-white text-sm">
              {files.map((file, index) => (
                <li key={index} className="flex items-center">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="ml-2 text-red-500"
                    onClick={() => handleRemoveFile(file.name)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    );
  };

  async function handleUpdate(e) {
    e.preventDefault();
    e.stopPropagation();
    const form = new FormData(e.target);

    try {
      const formData = new FormData();

      fileDataList.forEach((file, index) => {
	 console.log(`Processing file ${index + 1}:`, file.name);
         formData.append(`myFiles`, file); // Use the same field name as in your server-side code
      });

      const toastId=showToast("Updating file...", "info", { autoClose: false });

      for (let pair of formData.entries()) {
	console.log(`FormData entry - Field: ${pair[0]}, File Name: ${pair[1].name}`);
      }
      try {
        console.log("Uploading files to: ", `${API_BASE_URL}/database/getdata`);
        const response = await fetch(`${API_BASE_URL}/database/getdata`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        const statusCode = data.statusCode;
        console.log('Data Response from server:', data);
        console.log('Status Response from server:', statusCode);

        if (statusCode == 200) {
          closeToast(toastId);
          showToast("Updating file successfully", "success", { autoClose: true });
        }
        else {
          showToast("Updating file failed", "error", { autoClose: true });
        }
      } catch (error) {
        console.error('Error uploading files:', error);
      }

      handleClose();
    } catch (error) {
      console.error("Error submitting data:", error);
      // Handle error state or display an error message
    }

    return false;
  }

  // Cannot do nested forms, it will cause all sorts of issues, so we portal this out
  // to the parent container form so we don't have nested forms.
  return createPortal(
    <ModalWrapper isOpen={isOpen}>
      <div className="relative w-full md:w-1/3 max-w-2xl max-h-full md:mt-8">
        <div className="relative bg-main-gradient rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.25)] max-h-[85vh] overflow-y-scroll no-scroll">
          <div className="flex items-start justify-between p-4 border-b rounded-t border-gray-500/50">
            <h3 className="text-xl font-semibold text-white">
              Upload CSV files
            </h3>
            <button
              onClick={handleClose}
              type="button"
              className="border-none transition-all duration-300 text-gray-400 bg-transparent hover:border-white/60 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center bg-sidebar-button hover:bg-menu-item-selected-gradient hover:border-slate-100 hover:border-opacity-50 border-transparent border"
              data-modal-hide="staticModal"
            >
              <X className="text-gray-300 text-lg" />
            </button>
          </div>

          <form encType="multipart/form-data"
            id="sql-connection-form"
            onSubmit={handleUpdate}
            onChange={FileUpload}
          >
            <div className="py-[17px] px-[20px] flex flex-col gap-y-6">
              <div className="flex flex-col w-full">

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              </div>

              {
                <div className="flex flex-col w-full">
                  <FileUpload files={files} setFiles={setFiles} />
                </div>
              }
            </div>
            <div className="flex w-full justify-between items-center p-3 space-x-2 border-t rounded-b border-gray-500/50">
              <button
                type="button"
                onClick={handleClose}
                className="border-none text-xs px-2 py-1 font-semibold rounded-lg bg-white hover:bg-transparent border-2 border-transparent hover:border-white hover:text-white h-[32px] w-fit -mr-8 whitespace-nowrap shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sql-connection-form"
                className="border-none text-xs px-2 py-1 font-semibold rounded-lg bg-primary-button hover:bg-secondary border-2 border-transparent hover:border-primary-button hover:text-white h-[32px] w-fit -mr-8 whitespace-nowrap shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
              >
                Upload CSV
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalWrapper>,
    document.getElementById("workspace-agent-settings-container")
  );
}
