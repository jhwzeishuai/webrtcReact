import { Button, Input } from 'antd'
import { useEffect, useRef, useState } from 'react'
// import socket from './apis/socket'
import { io } from 'socket.io-client'

import './App.css'
import './Webrtc.scss'

const socketServer = {
	production: false,
	serverUrl: 'ws://localhost:9001',
}
let pc
let localStream
let toUser = 'lk'
const offerOptions = {
	offerToReceiveAudio: 1,
	offerToReceiveVideo: 1,
}
let socket
let icecandidate
let remoteDesc
let offerDesc
let answerDesc
let localCandidate = []
function App() {
	const LocalVideoRef = useRef(null)
	const RemoteVideoRef = useRef(null)
	const [UserName, setUserName] = useState('wjh')
	const [CallType, setCallType] = useState('call')

	// 创建信令服务连接(socket.io) 并监听实时请求
	function connectWs() {
		socket = io(socketServer.serverUrl, {
			auth: {
				user: UserName,
			},
		})
		socket.on('connect', () => {
			socket.on('message', async (res) => {
				const messageType = res.data.type
				switch (messageType) {
					// 接收到对方发送通话邀请
					case 'offer':
						toUser = res.from
						remoteDesc = res.data.desc
						setCallType('answer')

						break
					// 接收到对方应答邀请
					case 'answer':
						toUser = res.from
						await setLocalDescription()
						setRemoteDesc(res.data.desc)
						setCallType('')

						break
					// 接受对方发送的candidate
					case 'candidate':
						const candidates = res.data.desc || []
						candidates.forEach((i) => {
							const candidate = new RTCIceCandidate(i)
							pc && pc.addIceCandidate(candidate)
						})

						break
					default:
						break
				}
			})
		})
	}
	// 创建一个peerConnection
	function createPeer() {
		const server = {
			iceServers: [{ url: 'stun:stun1.l.google.com:19302' }],
		}
		pc = new RTCPeerConnection(server)
		pc.onicecandidate = handleIceCandidate

		// 显示对方画面回调,双方交换玩candidate后触发
		pc.ontrack = handleOnTrack
	}
	// 获取自己的stream 并显示自己的画面
	async function setLocalStream() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			})
			console.log(LocalVideoRef.current)
			LocalVideoRef.current.srcObject = stream
			localStream = stream
			localStream
				.getTracks()
				.forEach((track) => pc.addTrack(track, localStream))
		} catch (e) {
			console.log(`获取摄像头失败: ${e}`)
		}
	}

	// 创建一个音视频请求
	async function createOffer() {
		offerDesc = await pc.createOffer(offerOptions)
		console.log('offer', offerDesc)
		socket.emit('message', {
			from: 'wjh',
			to: 'lk',
			data: {
				type: offerDesc.type, //'offer'
				desc: offerDesc,
			},
		})
	}
	// 设置本地描述
	async function setLocalDescription() {
		try {
			await pc.setLocalDescription(offerDesc)
		} catch (e) {
			console.error(e)
		}
	}
	// 在setLocalDescription后会触发icecandidate,双方交换candidate (会触发多次 每次都将candidate缓存下来一次性发送)
	function handleIceCandidate(event) {
		if (event.candidate) {
			icecandidate = event.candidate
			console.log('触发candidate:',event.candidate)
			localCandidate.push(event.candidate)
		} else {
			sendCandidate()
			console.log('End of candidates.发送candidate')
		}
	}
	// 发送candidate
	function sendCandidate() {
		socket.emit('message', {
			from: UserName,
			to: toUser,
			data: {
				type: 'candidate',
				desc: localCandidate,
				label: icecandidate.sdpMLineIndex,
			},
		})
	}
	// 显示远程视频流
	function handleOnTrack(event) {
		console.log(event.streams)
		if (RemoteVideoRef.current.srcObject !== event.streams[0]) {
			RemoteVideoRef.current.srcObject = event.streams[0]
		}
	}
	// 设置远程描述文件
	async function setRemoteDesc(desc) {
		const description = new RTCSessionDescription(desc)
		pc.setRemoteDescription(description)
	}

	// 应答
	async function createAnswer() {
		createPeer()
		await setLocalStream()
		setRemoteDesc(remoteDesc)
		answerDesc = await pc.createAnswer()
		console.log('answer', answerDesc)
		await pc.setLocalDescription(answerDesc)
		socket.emit('message', {
			from: UserName,
			to: toUser,
			data: {
				type: 'answer',
				desc: answerDesc,
			},
		})
	}

	// 呼叫
	async function call() {
		// 创建链接
		createPeer()
		// 显示自己的画面
		await setLocalStream()
		// 创建 请求请求
		createOffer()
	}
	function callClick() {
		setCallType('')
		call()
	}

	//点击接受通话
	function answerClick() {
		// 创建一个应答对象 对应createOffer
		createAnswer()
		setCallType('')
	}

	// 挂断
	function hungUp() {
		pc.close()
		pc = null
		localStream = null
		icecandidate = null
		remoteDesc = null
		offerDesc = null
		answerDesc = null
		localCandidate = []
		RemoteVideoRef.current.srcObject = null
		LocalVideoRef.current.srcObject = null
        setCallType('call')
	}
	return (
		<div className="App">
			<div className="user_name">
				<Input.Group compact>
					<Input
						onChange={(e) => setUserName(e.target.value)}
						value={UserName}
						style={{ width: '300px' }}
					/>
					<Button type="primary" onClick={connectWs}>
						确认自己方用户名
					</Button>
				</Input.Group>
			</div>

			<div className="video_content">
				<div className="self_video item">
					<video ref={LocalVideoRef} autoPlay playsInline muted></video>
				</div>
				<div className="other_video item">
					<video ref={RemoteVideoRef} autoPlay playsInline></video>
				</div>
			</div>
			<div className="btn">
				{CallType === 'call' && (
					<Button type="primary" onClick={callClick}>
						呼叫
					</Button>
				)}
				{CallType === 'answer' && (
					<Button type="primary" onClick={answerClick}>
						接听
					</Button>
				)}
				{CallType !== 'call' && (
					<Button type="primary" danger onClick={hungUp}>
						挂断
					</Button>
				)}
			</div>
		</div>
	)
}

export default App
