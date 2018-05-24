import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import 'react-select/dist/react-select.css';
import _ from 'lodash';

//import assets
import styles from './ChatWindow.less';

// const AgoraRTC = window.AgoraRTC;

/**
 * ChatWindow Component
 */
class ChatWindow extends Component {
  constructor (props) {
    super(props);
    //you can get the input values in this.state
    this.state = {
      audioSource: '',
      videoSource: '',
      channel: '1000',
      host: false,
      isJoin: false,
      isPublish: false,
      message: '',
    };
    this.apiKey = '983f7f85aa654899a3ba264d12ebb9ed';
    this.audioSourceOptions = [];
    this.videoSourceOptions = [];
    this.client = null;
    this.localStream = null;
    this.videoViews = [];
    this.setMessage = this.setMessage.bind(this);
    this.join = this.join.bind(this);
    this.leave = this.leave.bind(this);
    this.publish = this.publish.bind(this);
    this.unPublish = this.unPublish.bind(this);
    this.getDevices = this.getDevices.bind(this);
    this.getDevices();
  }

  containsItem (arr, id) {
    arr.forEach((v, i) => {
      if (v.id === id) return true;
    });
    return false;
  }

  getDevices () {
    const that = this;
    if (!AgoraRTC.checkSystemRequirements()) {
      alert('browser is no support webRTC');
    }
    AgoraRTC.getDevices(devices => {
      console.log(devices);
      devices.forEach((d, i) => {
        if (d.kind === 'audioinput') {
          let deviceLabel = d.label || 'microphone ' + (that.audioSourceOptions.length + 1);
          that.audioSourceOptions.push({value: d.deviceId, label: deviceLabel});
        } else if (d.kind === 'videoinput') {
          let deviceLabel = d.label || 'camera ' + (that.videoSourceOptions.length + 1);
          that.videoSourceOptions.push({value: d.deviceId, label: deviceLabel});
        } else {
          console.log('Some other kind of source/device: ', d);
        }
      });
      if (that.audioSourceOptions.length > 0) {
        that.setState({audioSource: that.audioSourceOptions[0].value})
      }
      if (that.videoSourceOptions.length > 0) {
        that.setState({videoSource: that.videoSourceOptions[0].value})
      }
    });
  }

  join () {
    const that = this;
    this.setState({isJoin: true});
    let channel_key = null;

    console.log('Init AgoraRTC this.client with vendor key: ' + this.apiKey);
    this.client = AgoraRTC.createClient({mode: 'interop'});
    this.client.init(
      this.apiKey,
      function () {
        console.log('AgoraRTC this.client initialized');
        that.client.join(
          channel_key,
          that.state.channel,
          null,
          function (uid) {
            console.log('User ' + uid + ' join channel successfully');
            that.setMessage('User ' + uid + ' join channel successfully');

            if (that.state.host) {
              that.localStream = AgoraRTC.createStream({
                streamID: uid,
                audio: true,
                cameraId: that.state.videoSource,
                microphoneId: that.state.audioSource,
                video: that.state.host,
                screen: false,
              });
              if (that.state.host) {
                that.localStream.setVideoProfile('720p_3');
              }

              // The user has granted access to the camera and mic.983f7f85aa654899a3ba264d12ebb9ed
              that.localStream.on('accessAllowed', function () {
                console.log('accessAllowed');
              });

              // The user has denied access to the camera and mic.
              that.localStream.on('accessDenied', function () {
                console.log('accessDenied');
                that.setMessage('Access Denied');
              });

              that.localStream.init(
                function () {
                  console.log('getUserMedia successfully');
                  that.localStream.play('agora_local');

                  that.client.publish(that.localStream, function (err) {
                    console.log('Publish local stream error: ' + err);
                  });

                  that.client.on('stream-published', function (evt) {
                    console.log('Publish local stream successfully');
                  });
                },
                function (err) {
                  console.log('getUserMedia failed', err);
                  that.setMessage('Get User Media Failed:' + JSON.stringify(err));
                }
              );
            }
          },
          function (err) {
            console.log('Join channel failed', err);
            that.setMessage('Join channel failed:' + JSON.stringify(err));
          }
        );
      },
      function (err) {
        console.log('AgoraRTC client init failed', err);
        that.setMessage('AgoraRTC this.client init failed:' + JSON.stringify(err));
      }
    );

    let channelKey = '';
    this.client.on('error', function (err) {
      console.log('Got error msg:', err.reason);
      if (err.reason === 'DYNAMIC_KEY_TIMEOUT') {
        that.client.renewChannelKey(
          channelKey,
          function () {
            console.log('Renew channel key successfully');
          },
          function (err) {
            console.log('Renew channel key failed: ', err);
          }
        );
      }
    });

    that.client.on('stream-added', function (evt) {
      let stream = evt.stream;
      console.log('New stream added: ' + stream.getId());
      console.log('Subscribe ', stream);
      that.client.subscribe(stream, function (err) {
        console.log('Subscribe stream failed', err);
      });
    });

    that.client.on('stream-subscribed', function (evt) {
      let stream = evt.stream;
      console.log('Subscribe remote stream successfully: ' + stream.getId());
      let views = this.state.videoViews;
      if (!this.containsItem(views, stream.getId())) {
        views.push({
          id: stream.getId(),
          value: <div key={`key-${stream.getId()}`} id={`agora_remote${stream.getId()}`} className={styles.videoItem}>
            1</div>,
        });
        that.setState({videoViews: views});
      }
      setTimeout(() => stream.play('agora_remote' + stream.getId()), 100);
    });

    that.client.on('stream-removed', function (evt) {
      let stream = evt.stream;
      stream.stop();
      $('#agora_remote' + stream.getId()).remove();
      let views = this.state.videoViews;
      if (this.containsItem(views, stream.getId())) {
        _.remove(views, n => stream.getId() === n);
        that.setState({videoViews: views});
      }
      console.log('Remote stream is removed ' + stream.getId());
    });

    that.client.on('peer-leave', function (evt) {
      let stream = evt.stream;
      if (stream) {
        stream.stop();
        let views = this.state.videoViews;
        if (that.containsItem(views, stream.getId())) {
          _.remove(views, n => stream.getId() === n);
          that.setState({videoViews: views});
        }
        console.log(evt.uid + ' leaved from this channel');
        that.setMessage(evt.uid + ' leaved from this channel');
      }
    });
  }

  leave () {
    if (this.client === null)
      return;
    const that = this;
    this.setState({isJoin: false});
    this.client.leave(
      function () {
        console.log('Leavel channel successfully');
        // that.localVideoRef.getDOMNode().removeAll();
      },
      function (err) {
        console.log('Leave channel failed:' + err);
        this.setState({isJoin: true});
        that.setMessage('Leave channel failed:' + JSON.stringify(err));
      }
    );
  }

  publish () {
    if (this.client === null || this.localStream === null)
      return;
    this.setState({isPublish: true});
    this.client.publish(this.localStream, function (err) {
      console.log('Publish local stream error: ' + JSON.stringify(err));
    });
  }

  unPublish () {
    if (this.client === null)
      return;
    this.setState({isPublish: false});
    this.client.unpublish(this.localStream, function (err) {
      console.log('Unpublish local stream failed' + JSON.stringify(err));
    });
  }

  setMessage (msg) {
    this.setState({message: msg});
  }

  onJoin () {
    this.join();
  }

  onLeave () {
    this.leave();
  }

  onPublish () {
    this.publish();
  }

  onUnPublish () {
    this.unPublish();
  }

  render () {
    return (
      <div className={styles.chatWindowContainer}>
        <div className={styles.selectGroup}>
          <div className={styles.sourceSelect}>
            <span>AudioSource: </span>
            <Select
              className={styles.selectBtn}
              placeholder="Select AudioSource"
              value={this.state.audioSource}
              clearable={false}
              searchable={false}
              options={this.audioSourceOptions}
              onChange={v => this.setState({audioSource: v.value})}
            />
          </div>
          <div className={styles.sourceSelect}>
            <span>VideoSource: </span>
            <Select
              className={styles.selectBtn}
              placeholder="Select VideoSource"
              value={this.state.videoSource}
              clearable={false}
              searchable={false}
              options={this.videoSourceOptions}
              onChange={v => this.setState({videoSource: v.value})}
            />
          </div>
        </div>
        <div className={styles.editBoxGroup}>
          <div className={styles.channelBox}>
            <span>Channel:</span>
            <input
              type="text"
              onChange={e => this.setState({channel: e.target.value})}
              defaultValue={this.state.channel}
            />
          </div>
          <div className={styles.hostCheckBox}>
            <span>Host:</span>
            <input
              type="checkbox"
              disabled={this.state.isJoin}
              onChange={e => this.setState({host: e.target.value === 'on'})}
            />
          </div>
        </div>
        <div className={styles.btnGroup}>
          <button
            className={styles.blueBtn}
            onClick={() => this.onJoin()}
            disabled={this.state.isJoin}
          >
            Join
          </button>
          <button
            className={styles.blueBtn}
            onClick={() => this.onLeave()}
            disabled={!this.state.isJoin}
          >
            Leave
          </button>
          <button
            className={styles.blueBtn}
            onClick={() => this.onPublish()}
            disabled={this.state.isPublish || !this.state.isJoin}
          >
            Publish
          </button>
          < button
            className={styles.blueBtn}
            onClick={() => this.onUnPublish()}
            disabled={!this.state.isPublish || !this.state.isJoin}
          >
            UnPublish
          </button>
        </div>

        <div>{this.state.message}</div>

        <div className={styles.videoGroup}>
          <div id="agora_local" className={styles.localItem} ref={r => this.localVideoRef = r}></div>
          {_.map(this.state.videoViews, (v, i) => {
            console.log(v);
            return v;
          })}
        </div>
      </div>
    );
  }
}

export default ChatWindow;
