import { Socket } from 'socket.io';
import { RequestUser } from './dto/request-user.dto';

export interface SocketUserData {
  user?: RequestUser;
  userId?: string;
  username?: string;
}

export function socketUserData(
  socket: Socket & { data: SocketUserData },
): SocketUserData {
  return socket.data as SocketUserData;
}
