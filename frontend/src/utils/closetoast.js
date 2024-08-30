import { toast } from "react-toastify";

const closeToast=(toastId)=> {
    toast.dismiss(toastId);
  }

  export default closeToast;