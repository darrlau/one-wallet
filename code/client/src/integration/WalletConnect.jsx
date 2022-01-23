import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import WalletConnectClient from '@walletconnect/client'
import { InputBox, Link, Text } from '../components/Text'
import Image from 'antd/es/image'
import { Row } from 'antd/es/grid'
import Button from 'antd/es/button'
import cacheActions from '../state/modules/cache/actions'
import AnimatedSection from '../components/AnimatedSection'
import message from '../message'
import Spin from 'antd/es/spin'
import util, { checkCamera } from '../util'
import QrCodeScanner from '../components/QrCodeScanner'
import { WalletSelector } from './Common'
import List from 'antd/es/list'

const WalletConnect = ({ wc }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const walletConnectSession = useSelector(state => state.cache.walletConnectSession)
  const walletList = Object.keys(wallets).filter(addr => util.safeNormalizedAddress(addr))
  const [selectedAddress, setSelectedAddress] = useState({ value: walletList[0] })
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  // Default to QR unless wc provided.
  const [isScanMode, setScanMode] = useState(!wc)
  const [hasCamera, setHasCamera] = useState(false)
  const [uri, setUri] = useState('')
  const [connector, setConnector] = useState(null)
  const [peerMeta, setPeerMeta] = useState(null)
  const [requests, setRequests] = useState([])

  useEffect(() => {
    const f = async () => {
      const [hasCamera] = await checkCamera()
      setHasCamera(hasCamera)
    }

    f()
  }, [])

  useEffect(() => {
    if (wc) {
      initWalletConnect(wc)
    }
  }, [wc])

  const subscribeToEvents = (connector) => {
    if (connector) {
      connector.on('session_request', (error, payload) => {
        if (error) {
          throw error
        }
        //  dispatch(cacheActions.fetchVersion({ network }))
        const { peerMeta } = payload.params[0]
        setPeerMeta(peerMeta)
      })

      connector.on('session_update', error => {
        if (error) {
          throw error
        }

        dispatch(cacheActions.updateWalletConnectSession(connector.session))
      })

      connector.on('call_request', async (error, payload) => {
        console.log('EVENT', 'call_request', 'method', payload.method)
        if (error) {
          throw error
        }

        setRequests(requests => ([...requests, payload]))
      })

      connector.on('connect', (error, payload) => {
        if (error) {
          throw error
        }

        setConnected(true)
        dispatch(cacheActions.updateWalletConnectSession(connector.session))
      })

      connector.on('disconnect', (error, payload) => {
        if (error) {
          throw error
        }

        setConnected(false)
        setLoading(false)
        setConnector(null)
        setPeerMeta(null)
        dispatch(cacheActions.updateWalletConnectSession(null))
      })

      if (connector.connected) {
        setConnected(true)
      }

      setConnector(connector)
    }
  }

  useEffect(() => {
    if (walletConnectSession) {
      const connector = new WalletConnectClient({ session: walletConnectSession })
      subscribeToEvents(connector)
    }
  }, [])

  const initWalletConnect = async (uri, reportOnError = true) => {
    setLoading(true)

    try {
      const connector = new WalletConnectClient({
        uri,
        clientMeta: {
          description: '1Wallet',
          url: 'https://1wallet.crazy.one',
          icons: ['https://1wallet.crazy.one/1wallet.png'],
          name: '1Wallet',
        }
      })

      if (!connector.connected) {
        await connector.createSession()
      }

      setLoading(false)

      subscribeToEvents(connector)
    } catch (error) {
      if (reportOnError) {
        message.error('Failed to connect.', 15)
      }
      setLoading(false)
    }
  }

  const approveSession = () => {
    if (connector) {
      connector.approveSession({ chainId: connector.chainId, accounts: [selectedAddress.value] })
    }
  }

  const rejectSession = () => {
    if (connector) {
      connector.rejectSession()
      setUri('')
    }
  }

  const approveRequest = (request) => {
    if (connector) {
      // TODO: Handle requests based on methods
      // connector.approveRequest({
      //   id: request.id,
      //   result
      // })
      // setRequests(requests.filter(r => r.id !== request.id))
    }
  }

  const rejectRequest = (request) => {
    if (connector) {
      connector.rejectRequest({ id: request.id, error: { message: 'User rejected the requets.' } })
      setRequests(requests.filter(r => r.id !== request.id))
    }
  }

  const disconnect = () => {
    if (connector) {
      connector.killSession()
      setUri('')
    }
  }

  const onScan = (uri) => {
    initWalletConnect(uri, /* reportOnError= */ false)
  }

  useEffect(() => {
    if (!uri) {
      return
    }
    initWalletConnect(uri)
  }, [uri])

  return (
    <AnimatedSection>
      {loading && (
        <Row type='flex' justify='center' align='middle' style={{ minHeight: '100vh' }}>
          <Spin size='large' />
        </Row>)}
      {!connected
        ? (peerMeta && peerMeta.name
            ? (
              <>
                <Row type='flex' justify='center' align='middle'>
                  <Image style={{ maxWidth: '100px' }} src={peerMeta.icons[0]} alt={peerMeta.name} />
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Text>{peerMeta.name}</Text>
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Text>{peerMeta.description}</Text>
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Link target='_blank' href={peerMeta.url} rel='noreferrer'>{peerMeta.url}</Link>
                </Row>
                <Row type='flex' justify='center' align='middle' style={{ marginTop: '24px' }}>
                  <Button style={{ marginRight: '24px' }} onClick={approveSession}>Approve</Button>
                  <Button onClick={rejectSession}>Reject</Button>
                </Row>
              </>)
            : (
              <>
                <WalletSelector onAddressSelected={setSelectedAddress} filter={e => e.majorVersion >= 10} showOlderVersions={false} useHex={false} />
                {(!isScanMode || !hasCamera) && (
                  <>
                    <InputBox margin='auto' width={440} value={uri} onChange={({ target: { value } }) => setUri(value)} placeholder='Paste wc: uri...' />
                    {hasCamera && <Button onClick={() => setScanMode(true)}>Scan</Button>}
                  </>)}
                {/* TODO: disable text upload mode, it's used for dev debugging only. */}
                {isScanMode && hasCamera && <QrCodeScanner shouldInit supportedNonImgFiles={['text/plain']} btnText='Use Image or Text Instead' onScan={onScan} />}
              </>))
        : (
          <>
            <Row type='flex' justify='center' align='middle'>
              <Text>Connected!</Text>
            </Row>
            <Row type='flex' justify='center' align='middle'>
              <Button onClick={disconnect}>Disconnect</Button>
            </Row>
            {requests.length > 0 && (
              <List
                style={{ marginTop: '24px' }}
                size='small'
                header={<div>All pending requests</div>}
                bordered
                dataSource={requests}
                renderItem={item => (
                  <List.Item
                    actions={[<Button key='request-list-action-approve' onClick={() => approveRequest(item)}>Approve</Button>, <Button key='request-list-action-reject' onClick={() => rejectRequest(item)}>Reject</Button>]}
                  >{item.method}
                  </List.Item>)}
              />)}
          </>)}
    </AnimatedSection>
  )
}

export default WalletConnect
