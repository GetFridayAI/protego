export interface CassandraConfig {
  contactPoints: string[];
  port: number;
  keyspace: string;
  dataCenter: string;
  username: string;
  password: string;
  localDataCenter?: string;
  connectTimeout?: number;
  readTimeout?: number;
}

export function loadCassandraConfig(): CassandraConfig {
  const contactPointsStr = process.env.CASSANDRA_CONTACT_POINTS || 'localhost';
  const contactPoints = contactPointsStr.split(',').map((point) => point.trim());

  return {
    contactPoints,
    port: parseInt(process.env.CASSANDRA_PORT || '9042', 10),
    keyspace: process.env.CASSANDRA_KEYSPACE || 'protego_keyspace',
    dataCenter: process.env.CASSANDRA_DATA_CENTER || 'datacenter1',
    username: process.env.CASSANDRA_USERNAME || 'cassandra',
    password: process.env.CASSANDRA_PASSWORD || 'cassandra',
    localDataCenter: process.env.CASSANDRA_LOCAL_DATA_CENTER,
    connectTimeout:
      parseInt(process.env.CASSANDRA_CONNECT_TIMEOUT || '5000', 10) || 5000,
    readTimeout:
      parseInt(process.env.CASSANDRA_READ_TIMEOUT || '10000', 10) || 10000,
  };
}
