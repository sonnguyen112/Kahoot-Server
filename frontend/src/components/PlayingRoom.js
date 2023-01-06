import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { w3cwebsocket as W3CWebSocket } from "websocket";
import Question from "../components/Question";
import Questionnaire from "../components/Questionnaire";
import "../style/play.css";
import {
    Backdrop,
    CircularProgress,
  } from "@mui/material";

const answerHandler = (message, token_me, token_host, client, navigate, setIndexQues, setTypeRender, member, setMember, submit, setSubmit, setLoading) => {
    let tmp_message = JSON.parse(message.data);
    console.log(message);
    const onAnswer = (name_player, question_id, is_true, remaining_time) => {
        if (token_host === token_me) {
            let newSubmit = {
                name_player: name_player,
            }
            setSubmit([...submit, newSubmit]);
        }
    }
    const onNext = (index_next_ques) => {
        setIndexQues(index_next_ques);
    }
    const onScoreBoard = () => {
        setTypeRender(4);
    }
    const onAppend = (name_player, avatar) => {
        let newmessage = {
            name_player: name_player,
            avatar: avatar,
            score: 0
        }
        setMember([...member, newmessage]);
        setLoading(false)
    }
    const onDelete = (name_player) => {
        console.log(name_player);
        let index = [...member].findIndex((m) => m.name_player === name_player)
        if (index !== -1) {
            const copyMember = [...member];
            copyMember.splice(index, 1);
            setMember(copyMember);
        }

        if (token_host !== token_me && name_player === token_me) {
            client.close();
            navigate("/");
        }
    }
    const onTimeOut = (name_player) => {
        if (token_host === token_me) {
            let newSubmit = {
                name_player: name_player,
            }
            setSubmit([...submit, newSubmit]);
        }
    }
    switch (tmp_message.type_action) {
        case "answer":
            onAnswer(tmp_message.name_player, tmp_message.question_id, tmp_message.is_true, tmp_message.remaining_time);
            break;
        case "next":
            onNext(tmp_message.index_next_ques);
            break;
        case "score_board":
            onScoreBoard();
            break;
        case "append":
            onAppend(tmp_message.name_player, tmp_message.avatar);
            break;
        case "delete":
            onDelete(tmp_message.name_player);
            break;
        case "timeout":
            onTimeOut(tmp_message.name_player);
        default:
            break;
    }
}

const PlayingRoom = (props) => {
    const navigate = useNavigate();
    const [typeRender, setTypeRender] = useState(0);
    /*
        1. Screen question for 5s
        2. Screen question + answer + timer
        3. After answer (player only)
        4. Screen result
        5. Screen final
    */
    const [index_ques, setIndexQues] = useState(-1);
    const [time_interval, setTimeInt] = useState(5);
    const [time_show_question, setTimeShowQuestion] = useState(-1);
    const [time_show_title, setTimeShowTitle] = useState(-1);
    const [loading, setLoading] = useState(true)

    const client = useRef(null);

    const [submit, setSubmit] = useState([]);
    const submitRef = useRef(submit);
    useEffect(() => {
        submitRef.current = submit;
    })

    const [member, setMember] = useState([]);
    const memberRef = useRef(member);
    useEffect(() => {
        memberRef.current = member;
    })

    /*************************************
                HANDLE SOCKET
    *************************************/

    

    useEffect(() => {
        client.current = new W3CWebSocket("ws://127.0.0.1:8000/ws/play/" + props.pin + "/");
        client.current.onopen = () => {
            console.log("WebSocket client.current Connected");
            // setLoading(false)
            console.log(props.token_host, props.token_me, client.current);
            if (props.token_me !== props.token_host) {
                let s = '{ "type_action": "append", "name_player": "' + props.token_me + '", "avatar": ""}'
                console.log(s);
                client.current.send(s);
            }
            else {
                setTimeShowTitle(5);
            }
        };
        client.current.onmessage = (message) => {
            answerHandler(message, props.token_me, props.token_host, client.current, navigate,
                setIndexQues, setTypeRender,
                memberRef.current, setMember,
                submitRef.current, setSubmit,setLoading 
            )
        };

        return () => {
            console.log("BAO PRO");
            client.current.close();
            if (client.current.readyState === 1) { // <-- This is important
                client.current.close();
            }
        };
    }, []);




    const handleChoose = (option_id, question_id) => {
        if (props.token_host !== props.token_me) {
            let s = {
                type_action: "answer",
                name_player: props.token_me,
                question_id: question_id,
                option_id_player_choose: option_id,
                remaining_time: time_interval
            }
            // client.current.send(JSON.stringify(s));
            sendMesage(JSON.stringify(s))
            setTypeRender(3);
        }
    }


    const sendMesage = function (message) {
        waitForConnection(function () {
            console.log(message);
            client.current.send(message);
            // if (typeof callback !== 'undefined') {
            //   callback();
            // }
        }, 500);
    };
    
    const waitForConnection = function (callback, interval) {
        if (client.current.readyState === 1) {
            console.log("kết nối nè")
            callback();
        } else {
            console.log("chưa kết nối nè")
            // optional: implement backoff for interval here
            setTimeout(function () {
                waitForConnection(callback, interval);
            }, interval);
        }
    };
    



    ///                     THIS IS USED FOR TIME PROCESSING
    useEffect(() => {
        const interval = setTimeout(() => setTimeShowQuestion(time_show_question - 1), 1000);

        if (time_show_question === 0) {
            handleShowQuesnAns();
            clearTimeout(interval);
        }

        return () => clearTimeout(interval);
    }, [time_show_question]);

    useEffect(() => {
        const interval = setTimeout(() => setTimeShowTitle(time_show_title - 1), 1000);
        if (time_show_title === 0) {
            let s = '{"type_action": "next","index_next_ques":' + (index_ques + 1).toString() + '}';
            // client.current.send(s);
            sendMesage(s)
            setSubmit([]);
            clearTimeout(interval);
        }

        return () => clearTimeout(interval);
    }, [time_show_title]);

    useEffect(() => {
        console.log("index change:", index_ques)
        if (index_ques >= 0) {
            setTypeRender(1 + (index_ques === props.data.length ? 4 : 0));
            if (index_ques !== props.data.length) {
                setTimeShowQuestion(5)
            }
        }
    }, [index_ques])

    useEffect(() => {
        console.log("type render change:", typeRender)
    }, [typeRender])

    ///                     THIS IS END FOR TIME PROCESSING

    useEffect(() => {
        console.log(member);
    }, [member])

    useEffect(() => {
        console.log("hai vị thần", submit, member)
        if (submit.length && submit.length === member.length) {
            let s = '{"type_action": "score_board"}';
            sendMesage(s);
        }
    }, [submit])


    const handleNext = () => {
        let s = '{"type_action": "next","index_next_ques":' + (index_ques + 1).toString() + '}';
        sendMesage(s)
        client.current.send(s);
        setSubmit([]);
        // setTimeShowQuestion(5);
        // setTypeRender(1);
    }
    const handleShowQuesnAns = () => {
        setTypeRender(2);
        setTimeInt(props.data[index_ques].num_of_second);
    }
    const timeout = () => {
        if (props.token_host !== props.token_me) {
            let s = {
                type_action: "timeout",
                name_player: props.token_me
            }
            // client.current.send(JSON.stringify(s));
            sendMesage(JSON.stringify(s))
            // client.current.send(JSON.stringify(s));
        }
    }
    switch (typeRender) {
        case 0:
            return (
                <div className="container">
                    <Backdrop open={loading} sx={{ zIndex: 10 }}>
                    <CircularProgress color="primary" />
                    </Backdrop>
                    <div className="questionnaire">
                        {props.title}
                    </div>
                    <div class="loader-5 center"><span></span></div>
                </div>
            )
        case 1:
            return (
                <div className="container">
                    <Questionnaire question={props.data[index_ques].question} onClick={handleChoose} value={time_interval} setTimeInt={setTimeInt} timeout={timeout} />
                </div>
            )
        case 2:
            return (
                <div className="container">
                    <Question data={props.data[index_ques]} onClick={handleChoose} value={time_interval} setTimeInt={setTimeInt} timeout={timeout} />
                </div>
            )
        case 3:
            return (
                <div>
                    Đã trả lời rồi! Giỏi!
                </div>
            )
        case 4:
            return (props.token_host === props.token_me ?
                (
                    <div className="container">
                        <button onClick={handleNext}>Next</button>
                    </div>
                )
                :
                (
                    <div className="container">
                        Chuẩn bị tinh thần cho câu hỏi tiếp theo đi !
                    </div>
                )
            )
        case 5:
            return (
                <div className="container">
                    FINAL RESULT!
                </div>
            )
        default:
            break;
    }
}

export default PlayingRoom;