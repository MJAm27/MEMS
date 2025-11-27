import axios from "axios";

axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if(token){
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) =>{
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    (response) =>{
        return response;
    },
    (error)=>{
        if(error.response?.status === 401){
            console.log('Token Expired or Invalid. Logging out user.');
            localStorage.removeItem('authToken');
        }
        return Promise.reject(error);
    }
);