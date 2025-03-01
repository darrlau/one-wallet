import Button from 'antd/es/button'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import message from '../../message'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import { Hint, Label, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import React, { useState } from 'react'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEConstants from '../../../../lib/constants'
import { api } from '../../../../lib/api'
import walletActions from '../../state/modules/wallet/actions'
import ShowUtils from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import ONENames from '../../../../lib/names'
import { autoWalletNameHint } from '../../util'
const { Title } = Typography

const TransferDomain = ({ address, onClose }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const domain = wallet.domain || ''
  const network = useSelector(state => state.global.network)
  const [stage, setStage] = useState(-1)
  const [transferTo, setTransferTo] = useState({ value: '', label: '' })
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doTransferDomain = async () => {
    if (stage >= 0) {
      return
    }
    const subdomain = domain.slice(0, domain.length - ONEConstants.Domain.DEFAULT_TLD.length - ONEConstants.Domain.DEFAULT_PARENT_LABEL.length - 2)
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo },
      checkAmount: false
    }) || {}
    if (invalidOtp || !dest || invalidOtp2) return
    setStage(0)
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      commitHashGenerator: ONE.computeTransferDomainHash,
      commitHashArgs: { dest, subdomain },
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealTransferDomain,
      revealArgs: { dest, subdomain },
      prepareProofFailed,
      recoverRandomness,
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess: async (txId, messages) => {
        onRevealSuccess(txId, messages)
        const resolved = await api.blockchain.domain.resolve({ domain })
        if (resolved === dest) {
          message.success(`Domain ${domain} is transferred to ${dest}`)
          if (wallets[dest]) {
            dispatch(walletActions.bindDomain({ address: dest, domain }))
          }
          if (address !== resolved) {
            dispatch(walletActions.bindDomain({ address, domain: null }))
          }
        } else {
          message.success(`Domain ${domain} is not yet resolved to ${dest}. There might be a delay. Please check again later`)
        }
        onClose()
      }
    })
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      title={<Title level={2}>Transfer Domain</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large'>
        <Hint>You will transfer ownership of domain {wallet.domain} to this address. Note that address still needs to reclaim reverse address lookup. If it is an 1wallet, its owner will be able to do so in the user interface.</Hint>
        <Space align='baseline' size='large'>
          <Label><Hint>Address</Hint></Label>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
          />
        </Space>
        <OtpStack walletName={autoWalletNameHint(wallet)} otpState={otpState} doubleOtp={wallet.doubleOtp} onComplete={doTransferDomain} action='confirm' />
      </Space>
      {!domain &&
        <Row justify='center' style={{ margin: 12 }}>
          <Warning>This wallet is not bound to a domain</Warning>
        </Row>}

      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default TransferDomain
