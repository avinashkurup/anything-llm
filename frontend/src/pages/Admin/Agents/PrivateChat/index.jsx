import React, { useState, useEffect } from "react";
import { Plus, Database } from "@phosphor-icons/react";
import NewSQLConnection from "./NewConnectionModal";
import { useModal } from "@/hooks/useModal";
import SQLAgentImage from "@/media/agents/sql-agent.png";
import showToast from "@/utils/toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function PrivateChatSelection({
  skill,
  settings,
  toggleSkill,
  enabled = false,
  setHasChanges,
}) {
  const { isOpen, openModal, closeModal } = useModal();
  const [files, setFiles] = useState([]);

  async function removeConfirmation(newFileName) {
    if (window.confirm(`Delete ${newFileName} from the list of available tables? This cannot be undone.`)) {
      try {
        const payload = { tableName: newFileName };

        if (typeof initialFiles === "string") {
          try {
            const parsedArray = JSON.parse(initialFiles);
            for (const key in parsedArray) {
              if (parsedArray[key]?.name === newFileName) {
                delete parsedArray[key];
              }
            }
            const filteredArray = parsedArray.filter(Boolean);

            setFiles(filteredArray);
            setHasChanges(true);

          } catch (e) {
            console.error("Error parsing initial files:", e);
          }
        }

        console.log('Initiating data deletion with payload:', payload);

        console.log("Sending API request to delete data at:", `${API_BASE_URL}/database/deletedata`);
        const response = await fetch(`${API_BASE_URL}/database/deletedata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        console.log('Server responded with:', data);
        showToast("File deleted successfully", "success", { autoClose: true });
      } catch (error) {
        console.error('Failed to delete the table. Error details:', error);
        showToast("Failed to delete the file. Please try again.", "error", { autoClose: true });
      }
    } else {
      return false;
    }
  }

  function FileTable() {
    const [fileNames, setFileNames] = useState([]);

    const getTableInfo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/database/gettableinfo`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch table info. HTTP Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Successfully retrieved file names:', data);
        setFileNames(data); // Assuming data is an array of file names
      } catch (error) {
        console.error('Error fetching table info:', error);
        // Handle or log the error
      }
    };

    useEffect(() => {
      getTableInfo();
    }, []); // Empty dependency array means this runs once when the component mounts

    const handleDelete = (fileName) => {
      removeConfirmation(fileName);
      console.log('Deleting file:', fileName);
    };

    const FILE_BACKGROUND_COLOR = {
      backgroundColor: 'rgb(48, 50, 55)',
      opacity: 1
    };

    return (
      <div className="flex flex-col mt-2 gap-y-2 pl-8">
        <p className="text-white font-semibold text-sm">Uploaded Files</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-white whitespace-nowrap" style={FILE_BACKGROUND_COLOR}>
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">File Name</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fileNames.length > 0 ? (
                fileNames.map((fileName, index) => (
                  <tr key={`${fileName}-${index}`}>
                    <td className="px-4 py-2">{fileName}</td>
                    <td className="px-4 py-2">
                      <button
                        className="bg-red-500 text-white px-4 py-1 rounded"
                        onClick={() => handleDelete(fileName)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="px-4 py-2 text-center">
                    No table found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const handleFilesSubmit = (newFiles) => {
    console.log("New files submitted:", newFiles);
    setFiles((prevFiles) => {
      const existingFileNames = new Set(prevFiles.map(file => file.name));
      const filteredNewFiles = newFiles.filter(file => !existingFileNames.has(file.name));
      return [filteredNewFiles];
    });
  };

  const serializedFiles = files.map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));

  return (
    <>
      <div className="p-2">
        <div className="flex flex-col gap-y-[18px] max-w-[500px]">
          <div className="flex items-center gap-x-2">
            <Database size={24} color="white" weight="bold" />
            <label htmlFor="name" className="text-white text-md font-bold">
              Private Chat Agent
            </label>
            <label className="border-none relative inline-flex cursor-pointer items-center ml-auto">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enabled}
                onChange={() => toggleSkill(skill)}
              />
              <div className="pointer-events-none peer h-6 w-11 rounded-full bg-stone-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:shadow-xl after:border after:border-gray-600 after:bg-white after:box-shadow-md after:transition-all after:content-[''] peer-checked:bg-lime-300 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300"></span>
            </label>
          </div>
          <img
            src={SQLAgentImage}
            alt="Private Chat Agent"
            className="w-full rounded-md"
          />
          <p className="text-white text-opacity-60 text-xs font-medium py-1.5">
            Enable your agent to be able to leverage SQL to answer your questions
            from uploaded CSV files.
          </p>
          {enabled && (
            <>
              <input
                name="system::agent_private_chat"
                type="hidden"
                value={JSON.stringify(serializedFiles)}
              />
              <div className="flex flex-col mt-2 gap-y-2">
                <p className="text-white font-semibold text-sm">
                  Your Uploaded CSV Files.
                </p>
                <div className="flex flex-col gap-y-3">
                  <button
                    type="button"
                    onClick={openModal}
                    className="w-fit relative flex h-[40px] items-center border-none hover:bg-slate-600/20 rounded-lg"
                  >
                    <div className="flex w-full gap-x-2 items-center p-4">
                      <div className="bg-zinc-600 p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
                        <Plus
                          weight="bold"
                          size={14}
                          className="shrink-0 text-slate-100"
                        />
                      </div>
                      <p className="text-left text-slate-100 text-sm">
                        Upload CSV files
                      </p>
                    </div>
                  </button>
                  <div className="flex flex-col mt-2 gap-y-2 pl-8 overflow-x-auto max-h-96">
                    <FileTable />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <NewSQLConnection
        isOpen={isOpen}
        closeModal={closeModal}
        onSubmit={handleFilesSubmit}
      />
    </>
  );
}

