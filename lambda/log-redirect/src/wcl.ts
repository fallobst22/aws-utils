//Cross invocation cache
import {gql, GraphQLClient} from "graphql-request";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import jwtDecode from "jwt-decode";

let reports: Report[];

//Static values
const gqlEndpoint = 'https://www.warcraftlogs.com/api/v2/user';
const gqlQuery = gql`
    query getLatestLog($userId: Int!) {
        reportData {
            reports(userID: $userId, limit: 10) {
                data {
                    code
                    fights {
                        difficulty
                        keystoneLevel
                    }
                }
            }
        }
    }
`;

interface Report {
    code:string,
    fights: {
        difficulty: number
        keystoneLevel: number | null
    }[]
}
interface ReportList {
    reportData: {
        reports: {
            data: Report[]
        }
    }
}

export async function getReports() {
    if(reports) return reports;

    const client = new SecretsManagerClient({region: process.env.AWS_REGION});
    const token = await client.send(new GetSecretValueCommand({
        SecretId: process.env.OAUTH_SECRET_ARN
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    const parsedToken = jwtDecode(token.SecretString) as {sub: string};
    const userId = parseInt(parsedToken.sub);

    const gqlClient = new GraphQLClient(gqlEndpoint, {
        headers: {
            authorization: `Bearer ${token.SecretString}`,
        }
    });

    const response = await gqlClient.request<ReportList>(gqlQuery, {
        userId
    });

    reports = response.reportData.reports.data;
    return response.reportData.reports.data;
}

export async function getRaidReports() {
    let reports = await getReports();

    reports = reports.filter(report => {
        return report.fights.reduce((p, c) => p || (c.difficulty >= 3 && c.difficulty <= 5), false);
    });

    return reports;
}
export async function getLatestRaidReport() {
    return (await getRaidReports())?.[0].code;
}

export async function getMythPlusReports() {
    let reports = await getReports();

    reports = reports.filter(report => {
        return report.fights.reduce((p, c) => p || c.keystoneLevel != null, false);
    });

    return reports;
}

export async function getLatestMythPlusReport() {
    return (await getMythPlusReports())?.[0].code;
}

export const REPORT_URL_PREFIX = 'https://www.warcraftlogs.com/reports/';