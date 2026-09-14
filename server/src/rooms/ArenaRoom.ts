import { Client, Room } from 'colyseus';
import { MapSchema, Schema, type } from '@colyseus/schema';

class PlayerState extends Schema {
  @type('string') id = '';
  @type('number') gold = 100;
}

class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('string') phase = 'waiting';
  @type('number') serverTick = 0;
}

export class ArenaRoom extends Room<ArenaState> {
  maxClients = 2;
  private tickHandle?: ReturnType<typeof setInterval>;

  onCreate() {
    this.setState(new ArenaState());
    this.onMessage('ping', (client) => client.send('pong', { serverTick: this.state.serverTick }));
    this.tickHandle = setInterval(() => { this.state.serverTick += 1; }, 1000 / 20);
  }

  onJoin(client: Client) {
    const state = new PlayerState();
    state.id = client.sessionId;
    this.state.players.set(client.sessionId, state);
    this.state.phase = this.clients.length >= 2 ? 'battle' : 'waiting';
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.state.phase = 'waiting';
  }

  onDispose() {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }
}
