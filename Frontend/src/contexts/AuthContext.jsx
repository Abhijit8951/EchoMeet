import axios from "axios"
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";


export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`
})

export const AuthProvider = ({children}) => {
    const authContext = useContext(AuthContext)

    const [userData, setUserData] = useState(authContext);

    const router = useNavigate();

    const handleRegister = async(name, username, password) => {
        try {
            let request = await client.post("/register", {
                name: name,
                username: username,
                password: password
            })

            if(request.status === 201) { // 201 for Created
                return request.data.message;
            }
        } catch(err) {
            throw err;
        }
    }

    const handleLogin = async(username, password) => {
        try {
            let request = await client.post("/login", {
                username: username,
                password: password
            });

            if(request.status === 200) { // 200 for OK
                localStorage.setItem("token", request.data.token)
                router("/home");
            }
        } catch(err) {
            throw err;
        }
    }

    const getHistoryOfUser = async () => {
        try {
            let request = await client.get("/get-all-activity" ,{
                params: {
                    token: localStorage.getItem("token")
                }
            });
            return request.data;
        } catch(e) {
            throw e;
        }
    }

    const addToUserHistory = async(meetingCode) => {
        try {
            let request = await client.post("/add-to-activity", {
                token: localStorage.getItem("token"),
                meeting_code: meetingCode
            });
            return request
        } catch (e) {
            throw e;
        }
    }


    const data = {
        userData, setUserData, getHistoryOfUser, addToUserHistory, handleRegister, handleLogin 
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )
}