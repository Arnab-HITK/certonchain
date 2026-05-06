// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract CertificateVerifier {
    struct Certificate {
        string studentName;
        string course;
        string issueDate;
        string ipfsHash;
        bool isValid;
    }

    mapping(bytes32 => Certificate) public certificates;

    function issueCertificate(
        bytes32 certHash,
        string memory studentName,
        string memory course,
        string memory issueDate,
        string memory ipfsHash
    ) public {
        require(!certificates[certHash].isValid, "Certificate already issued");

        certificates[certHash] = Certificate({
            studentName: studentName,
            course: course,
            issueDate: issueDate,
            ipfsHash: ipfsHash,
            isValid: true
        });
    }

    function verifyCertificate(bytes32 certHash)
        public
        view
        returns (
            string memory studentName,
            string memory course,
            string memory issueDate,
            string memory ipfsHash,
            bool isValid
        )
    {
        Certificate storage cert = certificates[certHash];
        return (
            cert.studentName,
            cert.course,
            cert.issueDate,
            cert.ipfsHash,
            cert.isValid
        );
    }
}
